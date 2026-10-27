import type { TranslationMessages } from "ra-core";

/**
 * German messages for the react-admin (ra-core) and ra-supabase keys.
 * No maintained German package exists for react-admin v5, so these are kept
 * here; missing keys fall back to English (see i18nProvider).
 */
export const raGermanMessages = {
  ra: {
    action: {
      add_filter: "Filter hinzufügen",
      add: "Hinzufügen",
      back: "Zurück",
      bulk_actions:
        "1 Eintrag ausgewählt |||| %{smart_count} Einträge ausgewählt",
      cancel: "Abbrechen",
      clear_array_input: "Liste leeren",
      clear_input_value: "Wert löschen",
      clone: "Duplizieren",
      confirm: "Bestätigen",
      create: "Anlegen",
      create_item: "%{item} anlegen",
      delete: "Löschen",
      edit: "Bearbeiten",
      export: "Exportieren",
      list: "Liste",
      refresh: "Aktualisieren",
      remove_filter: "Filter entfernen",
      remove_all_filters: "Alle Filter entfernen",
      remove: "Entfernen",
      reset: "Zurücksetzen",
      save: "Speichern",
      search: "Suchen",
      search_columns: "Spalten suchen",
      select_all: "Alle auswählen",
      select_all_button: "Alle auswählen",
      select_row: "Diese Zeile auswählen",
      show: "Anzeigen",
      sort: "Sortieren",
      undo: "Rückgängig",
      unselect: "Auswahl aufheben",
      expand: "Aufklappen",
      close: "Schließen",
      open_menu: "Menü öffnen",
      close_menu: "Menü schließen",
      update: "Aktualisieren",
      move_up: "Nach oben",
      move_down: "Nach unten",
      open: "Öffnen",
      toggle_theme: "Hell/Dunkel umschalten",
      select_columns: "Spalten",
      update_application: "Anwendung neu laden",
    },
    boolean: {
      true: "Ja",
      false: "Nein",
      null: " ",
    },
    page: {
      create: "%{name} anlegen",
      dashboard: "Übersicht",
      edit: "%{name} %{recordRepresentation}",
      error: "Etwas ist schiefgelaufen",
      list: "%{name}",
      loading: "Lädt",
      not_found: "Nicht gefunden",
      show: "%{name} %{recordRepresentation}",
      empty: "Noch keine %{name}.",
      invite: "Möchten Sie einen Eintrag anlegen?",
      access_denied: "Zugriff verweigert",
      authentication_error: "Anmeldefehler",
    },
    input: {
      file: {
        upload_several:
          "Dateien hierher ziehen oder klicken, um eine auszuwählen.",
        upload_single: "Datei hierher ziehen oder klicken, um sie auszuwählen.",
      },
      image: {
        upload_several:
          "Bilder hierher ziehen oder klicken, um eines auszuwählen.",
        upload_single: "Bild hierher ziehen oder klicken, um es auszuwählen.",
      },
      references: {
        all_missing: "Die verknüpften Daten wurden nicht gefunden.",
        many_missing:
          "Mindestens ein verknüpfter Eintrag ist nicht mehr verfügbar.",
        single_missing: "Der verknüpfte Eintrag ist nicht mehr verfügbar.",
      },
      password: {
        toggle_visible: "Passwort verbergen",
        toggle_hidden: "Passwort anzeigen",
      },
    },
    message: {
      about: "Über",
      access_denied: "Sie haben keine Berechtigung für diese Seite",
      are_you_sure: "Sind Sie sicher?",
      authentication_error:
        "Der Anmeldeserver hat einen Fehler gemeldet, die Anmeldedaten konnten nicht geprüft werden.",
      auth_error: "Beim Prüfen der Anmeldung ist ein Fehler aufgetreten.",
      bulk_delete_content:
        "Möchten Sie diesen Eintrag wirklich löschen? |||| Möchten Sie diese %{smart_count} Einträge wirklich löschen?",
      bulk_delete_title: "%{name} löschen |||| %{smart_count} %{name} löschen",
      bulk_update_content:
        "Möchten Sie %{name} %{recordRepresentation} wirklich ändern? |||| Möchten Sie diese %{smart_count} Einträge wirklich ändern?",
      bulk_update_title:
        "%{name} %{recordRepresentation} ändern |||| %{smart_count} %{name} ändern",
      clear_array_input: "Möchten Sie die ganze Liste leeren?",
      delete_content: "Möchten Sie diesen Eintrag wirklich löschen?",
      delete_title: "%{name} %{recordRepresentation} löschen",
      details: "Details",
      error:
        "Es ist ein Fehler aufgetreten, die Anfrage konnte nicht ausgeführt werden.",
      invalid_form: "Das Formular ist nicht gültig. Bitte die Fehler prüfen",
      loading: "Bitte warten",
      no: "Nein",
      not_found: "Die Adresse ist falsch oder der Link ist nicht mehr gültig.",
      select_all_limit_reached:
        "Es gibt zu viele Einträge, um alle auszuwählen. Nur die ersten %{max} wurden ausgewählt.",
      unsaved_changes:
        "Einige Änderungen wurden nicht gespeichert. Möchten Sie sie verwerfen?",
      yes: "Ja",
      placeholder_data_warning:
        "Netzwerkproblem: Die Daten konnten nicht aktualisiert werden.",
    },
    navigation: {
      clear_filters: "Filter zurücksetzen",
      no_filtered_results: "Keine %{name} für diese Filter gefunden.",
      no_results: "Keine %{name} gefunden",
      no_more_results:
        "Seite %{page} gibt es nicht. Bitte die vorherige Seite wählen.",
      page_out_of_boundaries: "Seite %{page} gibt es nicht",
      page_out_from_end: "Das ist die letzte Seite",
      page_out_from_begin: "Das ist die erste Seite",
      page_range_info: "%{offsetBegin}-%{offsetEnd} von %{total}",
      partial_page_range_info:
        "%{offsetBegin}-%{offsetEnd} von mehr als %{offsetEnd}",
      current_page: "Seite %{page}",
      page: "Zu Seite %{page}",
      first: "Zur ersten Seite",
      last: "Zur letzten Seite",
      next: "Zur nächsten Seite",
      previous: "Zur vorherigen Seite",
      page_rows_per_page: "Zeilen pro Seite:",
      skip_nav: "Zum Inhalt springen",
    },
    sort: {
      sort_by: "Sortieren nach %{field_lower_first} %{order}",
      ASC: "aufsteigend",
      DESC: "absteigend",
    },
    auth: {
      auth_check_error: "Bitte melden Sie sich an",
      user_menu: "Profil",
      username: "Benutzername",
      password: "Passwort",
      email: "E-Mail",
      sign_in: "Anmelden",
      sign_in_error: "Anmeldung fehlgeschlagen, bitte erneut versuchen",
      logout: "Abmelden",
    },
    notification: {
      updated: "Eintrag geändert |||| %{smart_count} Einträge geändert",
      created: "Eintrag angelegt",
      deleted: "Eintrag gelöscht |||| %{smart_count} Einträge gelöscht",
      bad_item: "Ungültiger Eintrag",
      item_doesnt_exist: "Eintrag existiert nicht",
      http_error: "Fehler bei der Verbindung zum Server",
      data_provider_error: "Datenfehler. Details stehen in der Konsole.",
      i18n_error:
        "Die Übersetzungen für diese Sprache konnten nicht geladen werden",
      canceled: "Aktion abgebrochen",
      logged_out: "Ihre Sitzung ist abgelaufen, bitte erneut anmelden.",
      not_authorized: "Sie haben keinen Zugriff auf diesen Bereich.",
      application_update_available: "Eine neue Version ist verfügbar.",
      offline: "Keine Verbindung. Die Daten konnten nicht geladen werden.",
    },
    validation: {
      required: "Pflichtfeld",
      minLength: "Mindestens %{min} Zeichen",
      maxLength: "Höchstens %{max} Zeichen",
      minValue: "Mindestens %{min}",
      maxValue: "Höchstens %{max}",
      number: "Muss eine Zahl sein",
      email: "Muss eine gültige E-Mail-Adresse sein",
      oneOf: "Muss einer dieser Werte sein: %{options}",
      regex: "Muss diesem Format entsprechen (regexp): %{pattern}",
      unique: "Muss eindeutig sein",
    },
    saved_queries: {
      label: "Gespeicherte Abfragen",
      query_name: "Name der Abfrage",
      new_label: "Aktuelle Abfrage speichern...",
      new_dialog_title: "Aktuelle Abfrage speichern als",
      remove_label: "Gespeicherte Abfrage entfernen",
      remove_label_with_name: 'Abfrage "%{name}" entfernen',
      remove_dialog_title: "Gespeicherte Abfrage entfernen?",
      remove_message:
        "Möchten Sie diesen Eintrag aus Ihren gespeicherten Abfragen entfernen?",
      help: "Liste filtern und die Abfrage für später speichern",
    },
  },
  "ra-supabase": {
    auth: {
      email: "E-Mail",
      confirm_password: "Passwort bestätigen",
      sign_in_with: "Mit %{provider} anmelden",
      forgot_password: "Passwort vergessen?",
      reset_password: "Passwort zurücksetzen",
      password_reset:
        "Bitte prüfen Sie Ihre E-Mails auf die Nachricht zum Zurücksetzen.",
      missing_tokens: "Zugangs- und Aktualisierungstoken fehlen",
      back_to_login: "Zurück zur Anmeldung",
    },
    reset_password: {
      forgot_password: "Passwort vergessen?",
      forgot_password_details:
        "E-Mail-Adresse eingeben, um eine Anleitung zu erhalten.",
    },
    set_password: {
      new_password: "Passwort wählen",
    },
    validation: {
      password_mismatch: "Die Passwörter stimmen nicht überein",
    },
  },
  resources: {
    contacts: {
      name: "Kontakt |||| Kontakte",
      fields: {
        first_name: "Vorname",
        last_name: "Nachname",
        title: "Position",
        company_id: "Firma",
        email_jsonb: "E-Mail-Adressen",
        phone_jsonb: "Telefonnummern",
        background: "Hintergrund",
        linkedin_url: "LinkedIn-Profil",
        has_newsletter: "Newsletter",
        sales_id: "Zuständig",
        gender: "Anrede",
        tags: "Tags",
        status: "Status",
        last_seen: "Zuletzt gesehen",
        first_seen: "Angelegt",
      },
    },
    companies: {
      name: "Firma |||| Firmen",
      fields: {
        name: "Name",
        sector: "Branche",
        size: "Größe",
        website: "Website",
        phone_number: "Telefon",
        address: "Adresse",
        city: "Stadt",
        zipcode: "PLZ",
        country: "Land",
        description: "Beschreibung",
        sales_id: "Zuständig",
      },
    },
    deals: {
      name: "Deal |||| Deals",
      fields: {
        name: "Name",
        description: "Beschreibung",
        company_id: "Firma",
        contact_ids: "Kontakte",
        category: "Kategorie",
        amount: "Betrag",
        expected_closing_date: "Geplanter Abschluss",
        stage: "Phase",
      },
    },
    tasks: {
      name: "Aufgabe |||| Aufgaben",
      fields: {
        text: "Beschreibung",
        due_date: "Fällig am",
        type: "Art",
        contact_id: "Kontakt",
      },
    },
    sales: {
      name: "Benutzer |||| Benutzer",
      fields: {
        first_name: "Vorname",
        last_name: "Nachname",
        email: "E-Mail",
        administrator: "Administrator",
      },
    },
  },
} satisfies TranslationMessages;
