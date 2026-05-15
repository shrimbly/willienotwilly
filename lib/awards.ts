export type Award = {
  year: string;
  show: string;
  rank: string;
  category?: string;
  count?: number;
};

export type AwardGroup = {
  title: string;
  description?: string;
  projectSlug?: string;
  awards: Award[];
};

export const agencyRecognition = {
  title: "Agency recognition",
  description:
    "For seven straight years, DDB NZ has been named Campaign Brief NZ's Digital Agency of the Year and Digital Innovation Agency of the Year. That run lines up with my time at the agency and is a direct outcome of the innovation work I lead.",
};

export const awardGroups: AwardGroup[] = [
  {
    title: "Samsung — iTest",
    projectSlug: "try-galaxy",
    awards: [
      { year: "2022", show: "D&AD Awards", rank: "Black Pencil", category: "Overall Creative Excellence" },
      { year: "2022", show: "D&AD Awards", rank: "Yellow Pencil", category: "Online Experiences" },
      { year: "2022", show: "D&AD Awards", rank: "Graphite Pencil", category: "Media / Direct" },
      { year: "2022", show: "D&AD Awards", rank: "Wood Pencil", category: "Digital / Mobile" },
      { year: "2022", show: "Cannes Lions", rank: "Gold Lion", category: "Media" },
      { year: "2022", show: "Cannes Lions", rank: "Bronze Lion", category: "Direct" },
      { year: "2022", show: "Cannes Lions", rank: "Bronze Lion", category: "Creative Data" },
      { year: "2022", show: "Cannes Lions", rank: "Bronze Lion", category: "Social & Influencer (Community)" },
      { year: "2024", show: "WARC Awards", rank: "Gold", category: "Cultural Impact" },
      { year: "2023", show: "Effie APAC", rank: "Gold Effie", category: "Multi-Market Products" },
      { year: "2023", show: "Effie APAC", rank: "Gold Effie", category: "Consumer Electronics and Durables" },
      { year: "2022", show: "Spikes Asia", rank: "Grand Prix", category: "Brand Experience & Activation" },
      { year: "2022", show: "Spikes Asia", rank: "Bronze Spike", category: "Digital Craft (Innovation)" },
      { year: "2022", show: "MAD STARS", rank: "Grand Prix", category: "Mobile" },
      { year: "2022", show: "MAD STARS", rank: "Grand Prix", category: "Direct" },
      { year: "2022", show: "Caples Awards", rank: "Best in Show", category: "Overall Excellence" },
      { year: "2022", show: "Caples Awards", rank: "Silver", category: "Innovation" },
      { year: "2022", show: "Webby Awards", rank: "Honoree", category: "Best Media Strategy" },
      { year: "2022", show: "Webby Awards", rank: "Nominee", category: "Digital Campaign" },
      { year: "2022", show: "Axis Awards", rank: "Gold", category: "Brand Experience & Activation" },
      { year: "2021", show: "The One Show", rank: "Gold Pencil", category: "Interactive & Online" },
      { year: "2021", show: "The One Show", rank: "Silver Pencil", category: "Mobile Applications / Web Apps" },
    ],
  },
  {
    title: "Tourism New Zealand — If You Seek",
    projectSlug: "if-you-seek",
    awards: [
      { year: "2023", show: "Spikes Asia", rank: "Grand Prix", category: "Integrated Campaign" },
      { year: "2023", show: "Spikes Asia", rank: "Gold", category: "Integrated Spike" },
      { year: "2023", show: "Spikes Asia", rank: "Silver", category: "Digital Craft: UX & Journey Design" },
      { year: "2023", show: "Axis Awards", rank: "Special Award", category: "Cultural Axis" },
      { year: "2023", show: "Best Design Awards", rank: "Gold", category: "Digital Campaigns" },
      { year: "2023", show: "APAC Effie Awards", rank: "Bronze", category: "Travel / Tourism" },
      { year: "2023", show: "Aotearoa Effie Awards", rank: "Bronze", category: "International Marketing" },
      { year: "2023", show: "ICCA", rank: "Winner", category: "Best Marketing Award" },
    ],
  },
];

export const awardsFootnote =
  "Many more projects and awards sit alongside these. The selections above are the most significant of the work I've led, and some of these awards honour the campaign that wrapped around the digital experience too.";
