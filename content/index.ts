import type { Content } from '../engine/src/types'
import motives from './motives.json'
import names from './names.json'
import secrets from './secrets.json'
import shaadi from './settings/shaadi.json'

export const content = { names, secrets, motives, settings: [shaadi] } as unknown as Content
