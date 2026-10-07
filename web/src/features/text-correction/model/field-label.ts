/** Screen label of a correction field path (`buttons.0.name` → `버튼 1 이름`). */
export function fieldLabel(field: string): string {
  const parts = field.split(".");
  if (parts[0] === "buttons" && parts[2] === "name") return `버튼 ${Number(parts[1]) + 1} 이름`;
  if (parts[0] === "cards") return `카드 ${Number(parts[1]) + 1} ${parts[2] === "title" ? "제목" : "본문"}`;
  if (field === "body") return "본문";
  if (field === "text") return "직접 입력 텍스트";
  if (field === "title") return "제목";
  return field;
}
