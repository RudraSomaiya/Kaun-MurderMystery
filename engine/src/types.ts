export interface Room {
  id: string
  name: string
  // floor plan rectangle, in grid units
  x: number
  y: number
  w: number
  h: number
  doing: string[]
  quiet?: boolean
}

export interface Weapon {
  id: string
  name: string
  room: string
  method: string // "stabbed him with" style verb phrase, victim pronoun filled later
  found: string // how it looked at the scene
}

export interface SetEvent {
  from: string // "20:00"
  to: string
  room: string
  what: string
  pull: number // chance a character attends
}

export interface Archetype {
  id: string
  role: string // "the bride's maternal uncle"
  gender: 'm' | 'f'
  age: [number, number]
  family?: number
  traits: string
  voice: string
  haunts: string[]
  victim?: boolean
}

export interface Setting {
  id: string
  title: string
  place: string
  occasion: string
  blurb: string
  start: string
  families?: string[]
  rooms: Room[]
  events: SetEvent[]
  weapons: Weapon[]
  sounds: string[]
  archetypes: Archetype[]
}

export interface SecretT {
  id: string
  kind: 'meet' | 'sneak' | 'info'
  text: string // second person, may use {other} {room} {time}
  reveal: string[]
  settings?: string[]
}

export interface MotiveT {
  id: string
  text: string // second person, uses {victim}
  gossip: string // third person, uses {self} {victim}
  reveal: string[]
  settings?: string[]
}

export interface Names {
  m: string[]
  f: string[]
  last: string[]
}

export interface Content {
  settings: Setting[]
  names: Names
  secrets: SecretT[]
  motives: MotiveT[]
}

export interface Secret {
  id: string
  kind: SecretT['kind']
  text: string
  reveal: string[]
  with?: number
  step?: number
  room?: string
  lie?: string
}

export interface Character {
  i: number
  first: string
  name: string
  gender: 'm' | 'f'
  age: number
  arch: Archetype
  family?: string
  motive?: { id: string; text: string; gossip: string; reveal: string[] }
  secret?: Secret
  knows: string[]
}

export interface Line {
  t: number
  room: string
  doing: string
  with: number[]
  heard?: string // sound, only at the murder step
  noticed?: string
  found?: boolean
  lie?: boolean
}

export interface Case {
  id: string
  seed: string
  setting: Setting
  cast: Character[]
  victim: number
  killer: number
  steps: number
  pos: string[][] // pos[character][step] = room id
  murder: { step: number; room: string; weapon: Weapon; pickup: number; sound: string }
  discovery: { step: number; by: number }
  truth: Line[][]
  account: Line[][]
}
