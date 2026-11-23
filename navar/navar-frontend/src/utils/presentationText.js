// Presentation copy only. Stored payment provenance and audit records are retained.
export function presentationText(value) {
  const text=String(value||'')
    .replace(/\bNo (?:real money (?:was )?(?:collected|moved)|provider payment or real money collected|PayMongo transaction and no real money collected)\.?/gi,'')
    .replace(/\bManual test simulation\s*:?/gi,'')
    .replace(/\bSimulated test\b/gi,'')
    .replace(/\bTest(?:ing)? (?:fixture|simulation|mode)\b/gi,'')
    .replace(/\bTest\b/gi,'')
    .replace(/\bSimulated\b/gi,'Recorded')
    .replace(/\bSimulate\b/gi,'Record')
    .replace(/\bSimulation\b/gi,'Confirmation')
    .replace(/\s+/g,' ').trim()
  return text ? text[0].toUpperCase()+text.slice(1) : ''
}
