import type { Content } from '../engine/src/types'
import motives from './motives.json'
import names from './names.json'
import secrets from './secrets.json'
import filmset from './settings/filmset.json'
import hostel from './settings/hostel.json'
import shaadi from './settings/shaadi.json'
import taash from './settings/taash.json'
import villa from './settings/villa.json'

export const content = { names, secrets, motives, settings: [shaadi, hostel, filmset, villa, taash] } as unknown as Content
