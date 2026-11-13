export const studioEmail = "hello@illuminatestudios.com.au";

// Public sample imagery only. These are not photographs of studio clients.
// Replacing sample media with approved studio work requires updating this catalog.
export const photos = [
  {
    id: "1519225421980-715cb0215aed",
    category: "Wedding",
    alt: "Wedding reception tables with glassware and flower arrangements",
    title: "A place at the table",
  },
  {
    id: "1534528741775-53994a69daeb",
    category: "Portrait",
    external: true,
    alt: "Outdoor portrait with a warm yellow background",
    title: "In your own light",
  },
  {
    id: "1511895426328-dc8714191300",
    category: "Family",
    external: true,
    alt: "Family spending time together outdoors",
    title: "All together",
  },
  {
    id: "1524504388940-b1c1722653e1",
    category: "Editorial",
    external: true,
    alt: "Editorial-style portrait in natural light",
    title: "A different perspective",
  },
  {
    id: "1497366216548-37526070297c",
    category: "Brand & commercial",
    external: true,
    alt: "Bright professional workspace for a commercial visual story",
    title: "A sense of place",
  },
  {
    id: "1511285560929-80b456fea0bc",
    category: "Wedding",
    alt: "Newlyweds dancing beneath white balloons at their reception",
    title: "Just the two of you",
  },
  {
    id: "1519741497674-611481863552",
    category: "Wedding",
    alt: "A wedding bouquet held in warm afternoon light",
    title: "In the light",
  },
  {
    id: "1465495976277-4387d4b0b4c6",
    category: "Wedding",
    alt: "A close-up of newlyweds’ hands and wedding rings",
    title: "The promise",
  },
  {
    id: "1583939003579-730e3918a45a",
    category: "Wedding",
    alt: "Newlyweds walking together beneath a shower of confetti",
    title: "A little celebration",
  },
  {
    id: "1606216794074-735e91aa2c92",
    category: "Wedding",
    alt: "A couple celebrating their wedding outdoors",
    title: "A new beginning",
  },
];
export const imageUrl = (photo, width = 1400) =>
  photo.external
    ? `https://images.unsplash.com/photo-${photo.id}?w=${width}&q=80&auto=format&fit=crop`
    : `/portfolio/${photo.id}-1400.jpg`;
// Marketing collections and composition from _ds/StudioSuite-Mobile.dc.html.
// Booking confirmation and signed commercial terms remain backend-authoritative.
export const collections = [
  { id: "essentials", name: "Essentials", number: "I", price: 3200,
    duration: "Two-hour session", forWhom: "Portrait · family · headshots",
    includes: ["Two-hour session", "Lead photographer", "120+ selected images", "Six-month private gallery"] },
  { id: "signature", name: "Signature", number: "II", price: 5800,
    duration: "Wedding and editorial coverage", forWhom: "Weddings · editorial commissions",
    includes: ["Lead + second photographer", "600+ selected images", "Twelve-month private gallery", "90-minute engagement session"] },
  { id: "atelier", name: "Atelier", number: "III", price: 9200,
    duration: "Full-day coverage", forWhom: "Multi-day weddings · brand campaigns",
    includes: ["Full-day coverage, two photographers", "900+ selected images", "Fine-art print collection", "Album design · travel within Victoria"] },
];
export const experience = [
  { title: "Enquire", text: "Luma, our concierge, answers first and passes your dates to the studio." },
  { title: "Book", text: "The studio reviews availability and your proposal. Your date remains tentative until the agreement and required payment are accepted." },
  { title: "Prepare", text: "A conversation about locations, light and the moments that matter helps the photographer prepare for the day." },
  { title: "Receive", text: "Your private gallery of selected frames, ready for album and print choices." },
];
