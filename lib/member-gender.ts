/** Infer Male/Female from Tamil or English relationship labels used in member forms. */
export function inferGenderFromRelationship(
  relationship: string
): "Male" | "Female" | null {
  const r = (relationship || "").trim();
  if (!r) return null;

  const male = new Set([
    "கணவன்",
    "மகன்",
    "தந்தை",
    "குடும்பத் தலைவர்",
    "Husband",
    "Son",
    "Father",
    "Head",
    "Family Head",
  ]);
  const female = new Set([
    "மனைவி",
    "மகள்",
    "தாய்",
    "Wife",
    "Daughter",
    "Mother",
  ]);

  if (male.has(r)) return "Male";
  if (female.has(r)) return "Female";
  return null;
}
