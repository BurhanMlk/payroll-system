export interface CountryData {
  name: string;
  code: string; // ISO 3166-1 alpha-2
  currency: string; // ISO 4217
  rate: number; // approximate static rate: 1 USD = rate units of local currency
  cities: string[];
}

// Static dataset used by the public onboarding flow.
// Exchange rates are approximate placeholders for demo display only.
export const COUNTRIES: CountryData[] = [
  {
    name: "Pakistan",
    code: "PK",
    currency: "PKR",
    rate: 280,
    cities: ["Karachi", "Lahore", "Islamabad", "Rawalpindi", "Faisalabad", "Multan", "Peshawar", "Quetta", "Sialkot", "Hyderabad"],
  },
  {
    name: "India",
    code: "IN",
    currency: "INR",
    rate: 83,
    cities: ["Mumbai", "Delhi", "New Delhi", "Bengaluru", "Hyderabad", "Chennai", "Kolkata", "Pune", "Ahmedabad", "Jaipur"],
  },
  {
    name: "United States",
    code: "US",
    currency: "USD",
    rate: 1,
    cities: ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia", "San Antonio", "San Diego", "Dallas", "San Jose"],
  },
  {
    name: "United Kingdom",
    code: "GB",
    currency: "GBP",
    rate: 0.79,
    cities: ["London", "Birmingham", "Manchester", "Glasgow", "Liverpool", "Leeds", "Bristol", "Edinburgh", "Sheffield", "Cardiff"],
  },
  {
    name: "United Arab Emirates",
    code: "AE",
    currency: "AED",
    rate: 3.67,
    cities: ["Dubai", "Abu Dhabi", "Sharjah", "Ajman", "Ras Al Khaimah", "Fujairah", "Umm Al Quwain"],
  },
  {
    name: "Canada",
    code: "CA",
    currency: "CAD",
    rate: 1.36,
    cities: ["Toronto", "Montreal", "Vancouver", "Calgary", "Edmonton", "Ottawa", "Winnipeg", "Quebec City", "Hamilton", "Halifax"],
  },
  {
    name: "Australia",
    code: "AU",
    currency: "AUD",
    rate: 1.52,
    cities: ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Gold Coast", "Canberra", "Newcastle", "Hobart", "Darwin"],
  },
  {
    name: "Saudi Arabia",
    code: "SA",
    currency: "SAR",
    rate: 3.75,
    cities: ["Riyadh", "Jeddah", "Mecca", "Medina", "Dammam", "Khobar", "Taif", "Tabuk", "Abha", "Buraidah"],
  },
  {
    name: "Qatar",
    code: "QA",
    currency: "QAR",
    rate: 3.64,
    cities: ["Doha", "Al Rayyan", "Al Wakrah", "Al Khor", "Umm Salal", "Dukhan", "Mesaieed"],
  },
  {
    name: "Oman",
    code: "OM",
    currency: "OMR",
    rate: 0.38,
    cities: ["Muscat", "Salalah", "Sohar", "Nizwa", "Sur", "Ibri", "Barka"],
  },
  {
    name: "Kuwait",
    code: "KW",
    currency: "KWD",
    rate: 0.31,
    cities: ["Kuwait City", "Hawalli", "Salmiya", "Farwaniya", "Jahra", "Ahmadi"],
  },
  {
    name: "Bahrain",
    code: "BH",
    currency: "BHD",
    rate: 0.38,
    cities: ["Manama", "Riffa", "Muharraq", "Hamad Town", "Isa Town", "Sitra"],
  },
];
