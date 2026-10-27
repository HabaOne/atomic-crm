import { mergeTranslations, resolveBrowserLocale } from "ra-core";
import polyglotI18nProvider from "ra-i18n-polyglot";
import englishMessages from "ra-language-english";
import { raSupabaseEnglishMessages } from "ra-supabase-language-english";

import { crmGermanMessages } from "./i18n/de";
import { crmEnglishMessages } from "./i18n/en";
import { raGermanMessages } from "./i18n/raGerman";

const raSupabaseEnglishMessagesOverride = {
  "ra-supabase": {
    auth: {
      password_reset: "Check your emails for a Reset Password message.",
    },
  },
};

const english = mergeTranslations(
  englishMessages,
  raSupabaseEnglishMessages,
  raSupabaseEnglishMessagesOverride,
  crmEnglishMessages,
);

// German falls back to English for any key it does not translate
const german = mergeTranslations(english, raGermanMessages, crmGermanMessages);

export const i18nProvider = polyglotI18nProvider(
  (locale) => (locale === "de" ? german : english),
  // The locale the user picked is kept in the react-admin store; the
  // browser language only sets the first default.
  resolveBrowserLocale("en") === "de" ? "de" : "en",
  [
    { locale: "en", name: "English" },
    { locale: "de", name: "Deutsch" },
  ],
  { allowMissing: true },
);
