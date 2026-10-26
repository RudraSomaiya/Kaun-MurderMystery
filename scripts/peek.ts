import { content } from '../content'
import { generateCase, systemPrompt, solve } from '../engine/src'

const c = generateCase(content, process.argv[2] ?? 'chai')
console.log('killer:', c.cast[c.killer].name, solve(c))
for (const p of c.cast) if (p.i !== c.victim && (p.i === c.killer || p.secret?.step !== undefined)) { console.log('\n=====', p.name, '\n' + systemPrompt(c, p.i)); }
