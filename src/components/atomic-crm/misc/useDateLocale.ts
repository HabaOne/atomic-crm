import { de, enUS } from "date-fns/locale";
import { useLocaleState } from "ra-core";

/** The date-fns locale that matches the interface language. */
export const useDateLocale = () => {
  const [locale] = useLocaleState();
  return locale === "de" ? de : enUS;
};

/** Long weekday plus day and month, in the order the language uses. */
export const useLongDayFormat = () => {
  const [locale] = useLocaleState();
  return locale === "de" ? "EEEE, d. MMMM" : "EEEE, MMMM d";
};
