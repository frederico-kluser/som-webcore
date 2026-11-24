// DecisionModel over any decision backend, with Chrome's behaviour (RFC-0001).
//
// The class carries only the Decisions API surface (docs/spec/decisions-api-surface.md). Around it,
// what the Chrome implementation does and this library copies:
//   - validation and errors identical to Chrome 160 (validate.js);
//   - availability() in four states; create() that needs transient user activation while the model
//     is "downloadable" or "downloading", and reports the download through `monitor`;
//   - one model per page and tier, shared by every session (reference count): destroy() releases
//     the session, the model leaves the GPU when the last session leaves, after an idle time, or on
//     `pagehide`, and comes back from the local cache, without the network;
//   - one result decoder for every model (decode.js); QuotaExceededError instead of truncation;
//   - the native DecisionModel, when the browser has one, is never replaced (index.js).

import { getConfig } from './config.js';
import { decodeDecision, layoutOf } from './decode.js';
import { convertOptions, languageTags, prefix, unsupportedReason, validateQuestions } from './validate.js';

/** @import { Availability, DecisionModelCreateCoreOptions, DecisionModelCreateOptions, DecisionModelResult, PerformancePreference } from '../types/index.js' */
/** @import { DecisionBackend, LoadedModel } from '../types/backend.js' */
/** @import { QuestionLayout } from './decode.js' */

const READY_STATES = ['downloadable', 'downloading', 'available'];

/** @param {string} message @param {string} name */
const domError = (message, name) => new DOMException(message, name);
const decideAborted = () => domError(`${prefix('decide')}signal is aborted without reason`, 'AbortError');

/** Chrome's CreateMonitor: an EventTarget with `ondownloadprogress`; `loaded` goes from 0 to 1, `total` is 1. */
class CreateMonitor extends EventTarget {
  /** @type {((event: Event) => unknown) | null} */
  ondownloadprogress = null;
  #last = -1;

  /** @param {number} fraction */
  progress(fraction) {
    const loaded = Math.min(Math.max(fraction, 0), 1);
    if (loaded <= this.#last) return; // monotonic, each value once
    this.#last = loaded;
    const init = { loaded, total: 1, lengthComputable: true };
    const event = typeof ProgressEvent === 'function'
      ? new ProgressEvent('downloadprogress', init)
      : Object.assign(new Event('downloadprogress'), init);
    this.dispatchEvent(event);
    if (typeof this.ondownloadprogress === 'function') this.ondownloadprogress.call(this, event);
  }
}

/**
 * One loaded model of one tier, shared by every session of the page.
 */
class ModelHost {
  /** @type {LoadedModel | null} */
  #model = null;
  /** @type {Promise<LoadedModel> | null} */
  #loading = null;
  /** @type {Set<(fraction: number) => void>} */
  #listeners = new Set();
  #sessions = 0;
  #busy = 0;
  #unloadWhenFree = false;
  /** @type {ReturnType<typeof setTimeout> | null} */
  #timer = null;
  /** @type {Promise<unknown>} */
  #queue = Promise.resolve();

  /**
   * @param {DecisionBackend} backend
   * @param {string} tier
   */
  constructor(backend, tier) {
    this.backend = backend;
    this.tier = tier;
  }

  get sessions() {
    return this.#sessions;
  }

  get loaded() {
    return this.#model !== null;
  }

  /**
   * @param {((fraction: number) => void) | undefined} onProgress
   * @param {AbortSignal | undefined} signal aborts this caller's wait, not the shared load
   * @returns {Promise<LoadedModel>}
   */
  async #ensure(onProgress, signal) {
    if (this.#model) return this.#model;
    if (onProgress) this.#listeners.add(onProgress); // before the load starts: it may report at once
    if (!this.#loading) {
      this.#loading = this.backend
        .load({ tier: this.tier, onProgress: (f) => this.#listeners.forEach((fn) => fn(f)) })
        .then(
          (model) => {
            this.#loading = null;
            this.#model = model;
            if (this.#sessions === 0) this.unload(); // every creator gave up while it loaded
            return model;
          },
          (error) => {
            this.#loading = null;
            throw error;
          },
        );
    }
    try {
      return await abortable(/** @type {Promise<LoadedModel>} */ (this.#loading), signal);
    } finally {
      if (onProgress) this.#listeners.delete(onProgress);
    }
  }

  /**
   * A new session: count it and make sure the model is loaded.
   * @param {(fraction: number) => void} onProgress
   * @param {AbortSignal | undefined} signal
   */
  async attach(onProgress, signal) {
    this.#sessions += 1;
    this.#clearTimer();
    try {
      return await this.#ensure(onProgress, signal);
    } catch (error) {
      this.detach();
      throw error;
    }
  }

  /** A session left (destroy(), or collected without it). The last one unloads the model. */
  detach() {
    this.#sessions = Math.max(0, this.#sessions - 1);
    if (this.#sessions === 0) this.unload();
  }

  /**
   * Runs one decision on the model, one at a time; reloads it (from the local cache) if it was unloaded.
   * @template T
   * @param {(model: LoadedModel) => Promise<T>} fn
   * @param {() => boolean} cancelled
   * @returns {Promise<T>}
   */
  run(fn, cancelled) {
    const job = this.#queue.then(async () => {
      if (cancelled()) throw decideAborted(); // destroyed or aborted while queued: do not reload for it
      this.#clearTimer();
      this.#busy += 1;
      try {
        return await fn(await this.#ensure(undefined, undefined));
      } finally {
        this.#busy -= 1;
        if (this.#busy === 0 && (this.#unloadWhenFree || this.#sessions === 0)) this.unload();
        else this.#arm();
      }
    });
    this.#queue = job.catch(() => {});
    return job;
  }

  /** Frees the model now (last session, idle time, pagehide). Sessions stay valid. */
  unload() {
    this.#clearTimer();
    if (this.#busy > 0) {
      this.#unloadWhenFree = true;
      return;
    }
    this.#unloadWhenFree = false;
    const model = this.#model;
    this.#model = null;
    if (model) Promise.resolve().then(() => model.unload()).catch(() => {});
  }

  #arm() {
    const idle = getConfig().idleUnloadMs ?? Infinity;
    if (this.#busy > 0 || this.#sessions === 0 || !this.#model || !Number.isFinite(idle)) return;
    this.#timer = setTimeout(() => this.unload(), idle);
    /** @type {any} */ (this.#timer).unref?.();
  }

  #clearTimer() {
    if (this.#timer !== null) clearTimeout(this.#timer);
    this.#timer = null;
  }
}

/**
 * @template T
 * @param {Promise<T>} promise
 * @param {AbortSignal | undefined} signal
 * @returns {Promise<T>}
 */
function abortable(promise, signal) {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (v) => {
        signal.removeEventListener('abort', onAbort);
        resolve(v);
      },
      (e) => {
        signal.removeEventListener('abort', onAbort);
        reject(e);
      },
    );
  });
}

/** @param {unknown} error */
function asQuota(error) {
  if (error && typeof error === 'object' && /** @type {Error} */ (error).name === 'QuotaExceededError' && !(error instanceof DOMException)) {
    return domError(/** @type {Error} */ (error).message, 'QuotaExceededError');
  }
  return error;
}

const defaultActivation = () => /** @type {any} */ (globalThis).navigator?.userActivation?.isActive === true;

/**
 * @typedef {object} ClassOptions
 * @property {() => boolean} [hasActivation] transient user activation (default: navigator.userActivation.isActive)
 */

/**
 * Builds a DecisionModel class over a decision backend. One class per page: its sessions share
 * one model per tier.
 * @param {DecisionBackend} backend
 * @param {ClassOptions} [classOptions]
 */
export function createDecisionModelClass(backend, classOptions = {}) {
  const hasActivation = classOptions.hasActivation ?? defaultActivation;
  const token = Symbol('DecisionModel');
  /** @type {Map<string, ModelHost>} */
  const hosts = new Map();
  const hostFor = (/** @type {string} */ tier) => {
    let host = hosts.get(tier);
    if (!host) hosts.set(tier, (host = new ModelHost(backend, tier)));
    return host;
  };
  // A session collected without destroy() still releases its share of the model.
  const finalizer = typeof FinalizationRegistry === 'function'
    ? new FinalizationRegistry((/** @type {ModelHost} */ host) => host.detach())
    : null;
  if (typeof globalThis.addEventListener === 'function') {
    globalThis.addEventListener('pagehide', () => hosts.forEach((host) => host.unload()));
  }

  /** @param {ReturnType<typeof convertOptions>} opts */
  const select = (opts) => backend.select({
    preference: opts.preference,
    devTrialBackend: opts.devTrialBackend,
    resident: [...hosts.values()].filter((h) => h.loaded).map((h) => h.tier),
    config: getConfig(),
  });

  class DecisionModel {
    /** @type {ModelHost} */
    #host;
    /** @type {QuestionLayout[]} */
    #layouts;
    /** @type {unknown[]} */
    #compiled;
    /** @type {PerformancePreference} */
    #preference;
    #destroyed = false;
    #unregister = {};

    // No declared parameters: DecisionModel.length is 0, as in the browser.
    /** @param {any[]} args */
    constructor(...args) {
      const [key, state] = args;
      if (key !== token) throw new TypeError("Failed to construct 'DecisionModel': Illegal constructor");
      this.#host = state.host;
      this.#layouts = state.layouts;
      this.#compiled = state.compiled;
      this.#preference = state.preference;
      finalizer?.register(this, state.host, this.#unregister);
    }

    /**
     * @param {DecisionModelCreateCoreOptions} [options]
     * @returns {Promise<Availability>}
     */
    static async availability(options = {}) {
      const opts = convertOptions(options, 'availability');
      validateQuestions(opts.questions, false, 'availability');
      const tags = languageTags(opts, 'availability');
      if (unsupportedReason(opts, tags, backend.languages)) return 'unavailable';
      return (await select(opts)).availability;
    }

    /**
     * @param {DecisionModelCreateOptions} [options]
     * @returns {Promise<DecisionModel>}
     */
    static async create(options = {}) {
      const activated = hasActivation(); // transient activation is read when the call is made
      const opts = convertOptions(options, 'create');
      validateQuestions(opts.questions, true, 'create');
      const tags = languageTags(opts, 'create');
      const { signal } = opts;
      if (signal?.aborted) throw signal.reason;
      const why = unsupportedReason(opts, tags, backend.languages);
      if (why === 'modality') throw domError("Only 'text' expectedInputs modality is currently supported.", 'NotSupportedError');
      if (why === 'language') throw domError('The requested language options are not supported.', 'NotSupportedError');
      if (why === 'backend') throw domError('The requested backend is not available.', 'NotSupportedError');

      // Chrome calls the monitor callback before the activation check (RT: an empty event list).
      const monitor = new CreateMonitor();
      if (opts.monitor) opts.monitor(monitor);

      const { tier, availability } = await select(opts);
      if (availability === 'unavailable' || !READY_STATES.includes(availability)) {
        throw domError('The model is not available on this device.', 'NotSupportedError');
      }
      if (availability !== 'available' && !activated) {
        throw domError('Requires a user gesture when availability is "downloading" or "downloadable".', 'NotAllowedError');
      }

      const host = hostFor(tier);
      monitor.progress(0);
      const model = await host.attach((f) => monitor.progress(f), signal);
      monitor.progress(1);
      try {
        if (signal?.aborted) throw signal.reason;
        const questions = /** @type {NonNullable<typeof opts.questions>} */ (opts.questions);
        const layouts = questions.map(layoutOf);
        // The schema is translated once, here; each decide() only adds the input.
        const compiled = questions.map((q, i) => model.compile(q, layouts[i]));
        return new DecisionModel(token, { host, layouts, compiled, preference: opts.preference });
      } catch (error) {
        host.detach();
        throw asQuota(error);
      }
    }

    /**
     * @param {string} input
     * @param {{ signal?: AbortSignal }} [options]
     * @returns {Promise<DecisionModelResult>}
     */
    async decide(input, options = {}) {
      const signal = options?.signal;
      if (this.#destroyed || signal?.aborted) throw decideAborted();
      const text = String(input);
      if (text.trim() === '') throw new TypeError(`${prefix('decide')}DecisionModel.decide() input cannot be empty.`);
      const compiled = this.#compiled;
      let rows;
      try {
        rows = await this.#host.run((model) => model.score(compiled, text, signal), () => this.#destroyed || signal?.aborted === true);
      } catch (error) {
        throw asQuota(error);
      }
      if (this.#destroyed || signal?.aborted) throw decideAborted();
      /** @type {DecisionModelResult} */
      const result = {};
      this.#layouts.forEach((layout, i) => {
        result[layout.id] = decodeDecision(layout, rows[i]);
      });
      return result;
    }

    destroy() {
      if (this.#destroyed) return;
      this.#destroyed = true;
      finalizer?.unregister(this.#unregister);
      this.#host.detach();
    }

    get preference() {
      return this.#preference;
    }
  }

  // WebIDL operations and attributes are enumerable; class members are not by default.
  for (const target of [DecisionModel, DecisionModel.prototype]) {
    for (const key of Object.getOwnPropertyNames(target)) {
      if (['length', 'name', 'prototype', 'constructor'].includes(key)) continue;
      Object.defineProperty(target, key, { .../** @type {PropertyDescriptor} */ (Object.getOwnPropertyDescriptor(target, key)), enumerable: true });
    }
  }
  Object.defineProperty(DecisionModel.prototype, Symbol.toStringTag, { value: 'DecisionModel', configurable: true });

  return DecisionModel;
}
