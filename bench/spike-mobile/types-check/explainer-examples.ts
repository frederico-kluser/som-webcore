// Code from the explainer (commit 5ce6e10a81f766efaec670282696c0c57ba2de50, README.md, use cases 1–4),
// compiled against decision-model.d.ts. DOM-dependent helpers are declared, not implemented.
export {};

declare function setPetFilter(on: boolean): void;
declare function setPropertyFilter(label: string, priceTier: number | undefined): void;
declare function showSuggestedFilterChips(probabilities: Record<string, number>): void;
declare function showWarning(message: string): void;
declare function showHint(message: string): void;
declare function offerAutofillSuggestion(input: Element, label: string): void;
declare const inputElement: Element;
declare const draftText: string;

// Use case 1
const schema = {
  expectedInputs: [{ type: "text", languages: ["en"] }],
  questions: [
    { id: "pet_friendly", type: "boolean", prompt: "Does the traveler require pet-friendly accommodations?" },
    {
      id: "property_type", type: "choice", prompt: "Which property type best matches the traveler's request?",
      options: [
        { label: "hotel", description: "Standard hotel, resort, or boutique inn" },
        { label: "rental", description: "Entire apartment, house, or cabin rental" },
        { label: "hostel", description: "Shared dormitory or budget hostel" },
        { label: "any", description: "No specific property type mentioned" },
      ],
    },
    {
      id: "price_tier", type: "score", prompt: "Rate the target price tier from 1 (budget) to 4 (luxury).",
      options: [
        { label: "1", description: "Budget or inexpensive stay" },
        { label: "2", description: "Moderate or mid-range price" },
        { label: "3", description: "Upscale or premium property" },
        { label: "4", description: "Luxury or five-star resort" },
      ],
    },
  ],
} satisfies DecisionModelCreateOptions;

const status = await DecisionModel.availability(schema);
if (status === "available" || status === "downloadable") {
  const model = await DecisionModel.create(schema);
  const query = (document.querySelector("#search-input") as HTMLInputElement).value;
  const result = await model.decide(query);
  if (result.pet_friendly.confidence > 0.85) setPetFilter(result.pet_friendly.label === "true");
  if (result.property_type.confidence > 0.85) setPropertyFilter(result.property_type.label, result.price_tier.expectedScore);
  else showSuggestedFilterChips(result.property_type.probabilities);
  model.destroy();
}

// Use case 2
const actionMatcher = await DecisionModel.create({
  questions: [{
    id: "command", type: "choice", prompt: "Which command best fulfills the user's goal?",
    options: [
      { label: "export_pdf", description: "Download or save the document as a PDF" },
      { label: "share_link", description: "Invite collaborators or copy a sharing link" },
      { label: "archive_doc", description: "Move the document to trash or archive" },
    ],
  }],
});
const { command } = await actionMatcher.decide("let my coworkers view this file");
void command.label;

// Use case 3
const draftChecker = await DecisionModel.create({
  questions: [
    { id: "has_repro_steps", type: "boolean", prompt: "Does the draft include steps to reproduce the issue?" },
    { id: "contains_pii", type: "boolean", prompt: "Does the draft contain personal contact info, API keys, or passwords?" },
  ],
});
const { has_repro_steps, contains_pii } = await draftChecker.decide(draftText);
if (contains_pii.label === "true" && contains_pii.confidence > 0.8) showWarning("Please remove personal info or credentials before posting.");
else if (has_repro_steps.label === "false" && has_repro_steps.confidence > 0.8) showHint("Adding reproduction steps will help resolve this issue faster.");

// Use case 4
const fieldClassifier = await DecisionModel.create({
  questions: [{
    id: "field_purpose", type: "choice", prompt: "What type of user credential or data does this input field expect?",
    options: [
      { label: "username", description: "Account email, login ID, or handle" },
      { label: "current_password", description: "Existing password for signing in" },
      { label: "new_password", description: "New or updated password being created" },
      { label: "one_time_code", description: "Two-factor verification or SMS code" },
      { label: "other", description: "Unrelated input field" },
    ],
  }],
});
const { field_purpose } = await fieldClassifier.decide('Label: "Enter the 6-digit security code sent to your phone" | Placeholder: "000000"');
if (field_purpose.label !== "other" && field_purpose.confidence > 0.85) offerAutofillSuggestion(inputElement, field_purpose.label);

// Members the explainer names in "Core Requirements": signal, monitor, destroy().
const controller = new AbortController();
const monitored = await DecisionModel.create({
  questions: [{ id: "q", type: "score", prompt: "How severe is the incident?" }],
  signal: controller.signal,
  monitor(m) { m.addEventListener("downloadprogress", (e) => void e.loaded); },
});
await monitored.decide("The page is down for everyone.", { signal: controller.signal });
const preference: PerformancePreference = monitored.preference;
void preference;
monitored.destroy();
