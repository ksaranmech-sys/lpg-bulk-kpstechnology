/* =========================================================================
   CONFIG.JS — edited once per customer by the developer at install time.
   Copy this whole project folder for every new customer and change the
   values below. COMPANY_ID must be unique per customer — it is baked into
   that customer's license keys, so keys generated for one company will not
   work on another company's copy of the app.
   ========================================================================= */

const APP_CONFIG = {
  // Unique per customer. Letters/numbers only, no spaces. Do not change
  // after keys have been issued to this customer, or their keys will stop
  // validating.
  COMPANY_ID: "KPST",

  // Shown across the app and on printed / emailed reports. The admin can
  // also update this later from Settings inside the app.
  DEFAULT_COMPANY_NAME: "KPS Technology",
  DEFAULT_COMPANY_MOBILE: "+91 9994474009",
  DEFAULT_COMPANY_EMAIL: "saravanan.k@kpstechnology.in",

  // First-run admin account. The admin should change this password after
  // logging in for the first time (Settings > Users).
  DEFAULT_ADMIN_USERNAME: "admin",
  DEFAULT_ADMIN_PASSWORD: "saran2564",

  // Fixed dropdown options, per the operations spec.
  LOADING_LOCATIONS: [
    "MRPL", "Total-Mangalore", "AEGIS-Mangalore", "IPPL-Chennai",
    "CPCL", "Tuthugudi", "KRL"
  ],
  UNLOADING_LOCATIONS: [
    "Trichy", "Chengalpattu", "Madurai", "Manargudi",
    "Mayladuthurai", "Coimbatore", "Belgaum", "Shimoga", "Devanagunthi"
  ]
};
