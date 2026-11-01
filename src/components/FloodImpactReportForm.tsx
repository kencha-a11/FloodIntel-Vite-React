import { useState } from 'react'

export default function FloodImpactReportForm() {
  const [families, setFamilies] = useState(0)
  const [individuals, setIndividuals] = useState(0)
  const valid = individuals >= families

  return (
    <form>
      <label>Families <input type="number" value={families} onChange={e => setFamilies(Number(e.target.value))} /></label>
      <label>Individuals <input type="number" value={individuals} onChange={e => setIndividuals(Number(e.target.value))} /></label>
      {!valid && <p>Individuals must be at least families.</p>}
      <button type="submit" disabled={!valid}>Submit</button>
    </form>
  )
}