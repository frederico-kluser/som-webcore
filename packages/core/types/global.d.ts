// Global names of the Decisions API, for pages that use the browser's `DecisionModel` (or this
// library through it) without importing the module. Same declarations as ./index.d.ts.

import type * as T from './index.js';

declare global {
  type Availability = T.Availability;
  type PerformancePreference = T.PerformancePreference;
  type DecisionModelQuestionType = T.DecisionModelQuestionType;
  type LanguageModelMessageType = T.LanguageModelMessageType;
  type LanguageModelExpected = T.LanguageModelExpected;
  type DecisionModelOption = T.DecisionModelOption;
  type DecisionModelQuestion = T.DecisionModelQuestion;
  type DecisionModelCreateCoreOptions = T.DecisionModelCreateCoreOptions;
  type CreateMonitor = T.CreateMonitor;
  type CreateMonitorCallback = T.CreateMonitorCallback;
  type DecisionModelCreateOptions = T.DecisionModelCreateOptions;
  type DecisionModelDecideOptions = T.DecisionModelDecideOptions;
  type DecisionModelDecision = T.DecisionModelDecision;
  type DecisionModelResult = T.DecisionModelResult;
  type DecisionModel = T.DecisionModel;
  var DecisionModel: typeof T.DecisionModel;
}

export {};
