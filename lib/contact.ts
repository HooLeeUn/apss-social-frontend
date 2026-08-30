import { apiFetch } from "./api";

export type ContactCategory = "technical" | "commercial" | "requests_suggestions";

export interface ContactPayload {
  category: ContactCategory;
  subject: string;
  message: string;
}

export async function sendContactMessage(payload: ContactPayload): Promise<void> {
  await apiFetch("/contact/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
