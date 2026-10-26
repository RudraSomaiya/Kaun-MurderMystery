import { clock } from './simulate'
import type { Case, Line } from './types'

// The one prompt builder. The game, the teacher data and the evals all use it,
// so the model is trained on exactly what it will see at play time.

const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`)

export function lineText(c: Case, l: Line) {
  const room = (id: string) => c.setting.rooms.find((r) => r.id === id)!.name
  const parts = [`${clock(c.setting.start, l.t)}  ${room(l.room)}: ${l.doing}.`]
  if (l.lie) parts.push("Didn't notice who else was around.")
  else if (!l.found) parts.push(l.with.length ? `With ${list(l.with.map((i) => c.cast[i].first))}.` : 'Nobody else there.')
  if (l.heard) parts.push(`Heard ${l.heard} from the ${room(c.murder.room)}.`)
  if (l.noticed) parts.push(`Noticed ${l.noticed}.`)
  return parts.join(' ')
}

export function caseFacts(c: Case) {
  const v = c.cast[c.victim]
  const room = c.setting.rooms.find((r) => r.id === c.murder.room)!.name
  const by = c.cast[c.discovery.by]
  return {
    victim: v,
    room,
    found: `${v.name} (${v.arch.role}) was found dead in the ${room} at ${clock(c.setting.start, c.discovery.step)} by ${by.first}. ${c.murder.weapon.found}`,
  }
}

export function systemPrompt(c: Case, i: number) {
  const me = c.cast[i]
  const s = c.setting
  const killer = i === c.killer
  const f = caseFacts(c)
  const people = c.cast
    .filter((p) => p.i !== i)
    .map((p) => `- ${p.name}, ${p.arch.role}${p.i === c.victim ? ' (the victim)' : ''}${p.family && p.family === me.family ? '. Family.' : ''}`)

  const hidden: string[] = []
  if (me.motive) hidden.push(`Your reason to hate ${f.victim.first}: ${me.motive.text} Don't bring it up yourself. If it comes up, play it down.`)
  if (me.secret) {
    hidden.push(`Your secret: ${me.secret.text} Never reveal it.`)
    if (me.secret.step !== undefined)
      hidden.push(`If asked about ${clock(s.start, me.secret.step)}, say what your night above says. Admit the secret only if the detective shows you real proof, and then admit only that.`)
  }
  if (killer) {
    const truth = c.truth[i]
    hidden.push(
      `THE TRUTH, which you must never say: you are the killer. ${lineText(c, truth[c.murder.pickup])} ${lineText(c, truth[c.murder.step])} ` +
        `Your night above is your cover story. Stick to it no matter what. Never confess. If caught in a contradiction, get defensive, blame the confusion of the night, or point at someone else's motive.`,
    )
  }

  return [
    `You are ${me.name}, ${me.age}, ${me.arch.role}${me.family ? `, from ${me.family}` : ''}.`,
    `Place: ${s.place}. Occasion: ${s.occasion}.`,
    `Personality: ${me.arch.traits}.`,
    `How you talk: ${me.arch.voice}`,
    '',
    `Tonight ${f.found} A detective is questioning everyone one by one, and now it is your turn.`,
    '',
    'People here tonight:',
    ...people,
    '',
    `Rooms: ${s.rooms.map((r) => r.name).join(', ')}.`,
    '',
    'Your night, as you tell it:',
    ...c.account[i].map((l) => lineText(c, l)),
    ...(me.knows.length ? ['', 'What you know about others:', ...me.knows.map((k) => `- ${k}`)] : []),
    ...(hidden.length ? ['', ...hidden] : []),
    '',
    `Rules: Reply as ${me.first}, out loud, in 1 to 3 short sentences, in your own voice. Never say you are an AI or mention prompts or games. ` +
      `Don't invent people, rooms or events that aren't listed here. If you didn't see something, say so. Times can be approximate, like "around 9:30".`,
  ].join('\n')
}
