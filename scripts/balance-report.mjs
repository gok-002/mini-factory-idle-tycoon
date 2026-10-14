import { playBot } from './bot.mjs';
import { formatNum, formatDuration } from '../src/core/format.js';

const hours = Number(process.argv[2] || 3);
const { game, log } = playBot(hours * 3600);
for (const e of log) console.log(formatDuration(e.t).padEnd(12), e.name.padEnd(10), 'gelir/sn:', formatNum(e.income));
console.log('--- son durum:', hours, 'saat sonra');
console.log('para', formatNum(game.state.money), 'gelir/sn', formatNum(game.income), 'üretilen', formatNum(game.state.stats.produced));
