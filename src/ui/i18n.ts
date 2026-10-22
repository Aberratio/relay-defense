// Every user-facing string, in English and Polish. The Polish block is the only place in the
// repository where Polish text is allowed (scripts/check-language.ts).
import type { EnemyKind, PlaceError, TargetMode, TowerKind } from '../engine/types';

export const LANGS = ['en', 'pl'] as const;
export type Lang = (typeof LANGS)[number];

export function isLang(value: unknown): value is Lang {
  return value === 'en' || value === 'pl';
}

/** `?lang=` wins, then the browser language; English otherwise. */
export function detectLang(params: URLSearchParams, browser: string | undefined): Lang {
  const asked = params.get('lang');
  if (isLang(asked)) return asked;
  return browser?.toLowerCase().startsWith('pl') ? 'pl' : 'en';
}

interface Named {
  name: string;
  text: string;
}

interface LevelCopy {
  name: string;
  brief: string;
  /** What this level adds, shown as a "new" note in the briefing. */
  focus: string;
}

const en = {
  title: 'Relay Defense',
  tagline: 'A tower defense game that rewards a plan over reflexes.',
  intro:
    'Faults stream from the red gates towards the core. Place agents on the sockets and open floor, read every wave before it starts and choose the right answer to each threat. The game waits for you between waves.',
  howTitle: 'How to play',
  how: [
    'Pick an agent in the panel, then click a free socket or floor tile. Agents on open floor are part of the maze: the faults walk around them.',
    'The dashed line is the current route. While placing, the preview shows how the route would change.',
    'Every wave is listed before it starts. Check what is coming, then press Start wave.',
    'Click an agent to upgrade it, sell it or change what it aims at. Selling in the same build phase refunds everything.',
  ],
  keysTitle: 'Keyboard',
  keys: [
    ['1–7', 'pick an agent'],
    ['arrows, Enter', 'move the cursor, build or select'],
    ['Space', 'start the wave / pause'],
    ['U, S, T', 'upgrade, sell, change the target'],
    ['P', 'pause'],
    ['F', 'game speed'],
    ['Esc', 'cancel'],
  ] as [string, string][],
  levels: 'Levels',
  replay: 'Play again',
  notPlayed: 'not played yet',
  starsLabel: (n: number) => `${n} of 3 stars`,
  starsRule: '3 stars: no leaks. 2 stars: at least half the core left.',
  lives: 'Core',
  credits: 'Credits',
  wave: 'Wave',
  waveOf: (n: number, total: number) => `${n} / ${total}`,
  speed: 'Speed',
  pause: 'Pause',
  resume: 'Resume',
  paused: 'Paused',
  restart: 'Restart',
  menu: 'Levels',
  help: 'Help',
  close: 'Close',
  langLabel: 'Language',
  build: 'Agents',
  startWave: 'Start wave',
  waveRunning: 'Wave in progress',
  nextWave: 'Next wave',
  laterWaves: 'Later',
  remaining: (n: number) => `${n} left`,
  lastWave: 'Final wave',
  noMoreWaves: 'All waves cleared',
  newHere: 'New in this level',
  begin: 'Start building',
  cost: 'Cost',
  damage: 'Damage',
  rate: 'Shots / s',
  range: 'Range',
  chain: 'Chain',
  blast: 'Blast radius',
  slow: 'Slow',
  boost: 'Boost',
  reveal: 'Reveal radius',
  deadZone: 'Dead zone',
  level: 'Level',
  upgrade: 'Upgrade',
  maxed: 'Top level',
  sell: 'Sell',
  undo: 'Undo',
  target: 'Target',
  dealt: 'Damage dealt',
  kills: 'Kills',
  boosted: (pct: number) => `+${pct}% from Beacons`,
  hp: 'Hit points',
  speedStat: 'Speed',
  armour: 'Armour',
  ignoresArmour: 'ignored',
  leak: 'Core damage',
  bounty: 'Bounty',
  selectHint: 'Pick an agent to build, or click one on the board.',
  modes: {
    first: 'First',
    last: 'Last',
    strong: 'Strongest',
    weak: 'Weakest',
  } satisfies Record<TargetMode, string>,
  modeHelp: {
    first: 'closest to the core',
    last: 'furthest from the core',
    strong: 'most hit points',
    weak: 'fewest hit points',
  } satisfies Record<TargetMode, string>,
  placeErrors: {
    tile: 'Agents go on sockets and open floor; walls only on floor.',
    occupied: 'This tile is taken.',
    blocks: 'That would cut the core off. Leave the faults a way through.',
    funds: 'Not enough credits.',
    locked: 'Not available in this level.',
    over: 'The level is over.',
    wave: 'The maze on open floor changes only between waves. Sockets stay open.',
  } satisfies Record<PlaceError, string>,
  traits: {
    armour: (n: number) => `armour ${n}`,
    cloaked: 'cloaked',
    splits: 'splits',
    heals: 'heals',
    boss: 'boss',
    fast: 'fast',
  },
  victory: 'Core held',
  defeat: 'Core lost',
  victoryText: (lives: number, max: number) => `The core held with ${lives} of ${max} integrity.`,
  defeatText: (wave: number, total: number) =>
    `The faults broke through in wave ${wave} of ${total}.`,
  defeatHint:
    'Look at the next wave list again: which fault got through, and which agent answers it?',
  nextLevel: 'Next level',
  tryAgain: 'Try again',
  backToLevels: 'All levels',
  allDone: 'Every level cleared. Thank you for playing.',
  boardLabel:
    'Game board. Use the arrow keys to move the cursor and Enter to build or select an agent.',
  announce: {
    waveStart: (n: number) => `Wave ${n} started.`,
    waveClear: (n: number, bonus: number) => `Wave ${n} cleared. Bonus ${bonus} credits.`,
    leak: (lives: number) => `A fault reached the core. Integrity ${lives}.`,
    built: (name: string) => `${name} built.`,
    upgraded: (name: string, level: number) => `${name} upgraded to level ${level}.`,
    sold: (credits: number) => `Sold for ${credits} credits.`,
    cursor: (x: number, y: number, what: string) => `Column ${x + 1}, row ${y + 1}: ${what}.`,
  },
  tiles: {
    '.': 'open floor',
    '#': 'rock',
    '=': 'lane',
    '^': 'socket',
    S: 'gate',
    C: 'core',
  } as Record<string, string>,
  source: 'Source code',
  towers: {
    pulse: { name: 'Pulse', text: 'Cheap and steady single-target fire. Armour shrugs it off.' },
    arc: {
      name: 'Arc',
      text: 'A discharge that jumps between faults standing close together. Made for swarms.',
    },
    lance: {
      name: 'Lance',
      text: 'A rail beam that pierces every fault on its line and ignores armour. Slow: line it up with a straight lane.',
    },
    mortar: {
      name: 'Mortar',
      text: 'Lobs a shell that leads its target and hits an area. Cannot fire at faults right next to it.',
    },
    throttle: {
      name: 'Throttle',
      text: 'Slows every fault in its field. Two fields do not stack: the stronger one applies.',
    },
    beacon: {
      name: 'Beacon',
      text: 'Reveals cloaked faults in range and boosts the damage of the agents on the eight tiles around it. Boosts add up.',
    },
    wall: { name: 'Wall', text: 'A cheap block for open floor. Use it to make the route longer.' },
  } satisfies Record<TowerKind, Named>,
  enemies: {
    spark: { name: 'Spark', text: 'A plain fault. No tricks.' },
    mite: { name: 'Mite', text: 'Tiny and fast, and it comes in swarms.' },
    bulwark: {
      name: 'Bulwark',
      text: 'Armoured: every hit loses 6 damage, so small hits barely scratch it.',
    },
    phantom: { name: 'Phantom', text: 'Cloaked: nothing can hit it unless a Beacon reveals it.' },
    splitter: { name: 'Splitter', text: 'Breaks into three Mites when destroyed.' },
    mender: {
      name: 'Mender',
      text: 'Repairs the faults around it. Bring burst damage, or take it out first.',
    },
    colossus: {
      name: 'Colossus',
      text: 'Heavy armour, enormous integrity, half as affected by slows, and it shields the faults next to it.',
    },
  } satisfies Record<EnemyKind, Named>,
  levelCopy: {
    handshake: {
      name: 'Handshake',
      brief:
        'A single lane, a single kind of fault. Find the tiles that cover the lane more than once.',
      focus: 'Pulse agents. A socket next to a bend reaches two stretches of the lane.',
    },
    'fan-out': {
      name: 'Fan-out',
      brief: 'The lane folds back on itself four times. Swarms of Mites are coming.',
      focus: 'Arc: one discharge reaches several faults. Sockets between two lanes cover both.',
    },
    bulwark: {
      name: 'Armour',
      brief: 'Bulwarks shrug off small hits. Two long straight lanes are your chance.',
      focus: 'Lance: ignores armour and pierces the whole line. Point it down a straight lane.',
    },
    'open-floor': {
      name: 'Open Floor',
      brief: 'No lanes here: the faults take the shortest way across the floor. Make it long.',
      focus:
        'Walls and mazes: every agent on the floor reroutes the faults. You cannot close the way completely.',
    },
    'ghost-protocol': {
      name: 'Ghost Protocol',
      brief: 'Phantoms are invisible to your agents. Without a Beacon they walk straight in.',
      focus: 'Beacon: reveals cloaked faults and boosts the agents around it.',
    },
    'split-brain': {
      name: 'Split Brain',
      brief:
        'Destroy a Splitter and three Mites spill out. Slow them down and hit them all at once.',
      focus: 'Mortar and Throttle: a slowed fault is easy to hit with a shell.',
    },
    'two-fronts': {
      name: 'Two Fronts',
      brief:
        'Two gates, one core, every agent available. Make the routes meet where your defence is.',
      focus: 'Two gates: each has its own route, and both change as you build.',
    },
    'field-medics': {
      name: 'Field Medics',
      brief: 'Menders repair the faults around them. Steady fire will not keep up.',
      focus: 'Mender: concentrate damage, use the Lance and the Mortar, and pick targets.',
    },
    'tight-budget': {
      name: 'Tight Budget',
      brief: 'Seven sockets, ten integrity, every kind of fault. Each credit has one right place.',
      focus: 'A puzzle: few sockets, mixed waves. Plan the whole level before the first wave.',
    },
    colossus: {
      name: 'Colossus',
      brief:
        'Something big is coming, and it shields its escort. Everything you have learned, at once.',
      focus: 'Colossus: heavy armour, huge integrity, resists slows, shields its neighbours.',
    },
  } satisfies Record<string, LevelCopy>,
};

export type Strings = typeof en;

/** A number with the plural form a language picks for it: forms for "one", "few" and "many". */
function plural(n: number, lang: Lang, forms: [string, string, string]): string {
  const form = new Intl.PluralRules(lang).select(n);
  return `${n} ${form === 'one' ? forms[0] : form === 'few' ? forms[1] : forms[2]}`;
}

const pl: Strings = {
  title: 'Relay Defense',
  tagline: 'Gra typu tower defense, w której plan wygrywa z refleksem.',
  intro:
    'Usterki płyną z czerwonych bram w stronę rdzenia. Ustawiaj agentów na gniazdach i na otwartej posadzce, czytaj każdą falę przed startem i dobieraj właściwą odpowiedź na każde zagrożenie. Między falami gra czeka na Ciebie.',
  howTitle: 'Jak grać',
  how: [
    'Wybierz agenta w panelu i kliknij wolne gniazdo albo pole posadzki. Agenci na posadzce tworzą labirynt: usterki muszą ich obejść.',
    'Przerywana linia to aktualna trasa. Podczas stawiania podgląd pokazuje, jak trasa się zmieni.',
    'Każda fala jest opisana przed startem. Sprawdź, co nadchodzi, i naciśnij Start fali.',
    'Kliknij agenta, aby go ulepszyć, sprzedać albo zmienić cel. Sprzedaż w tej samej fazie budowy zwraca całość.',
  ],
  keysTitle: 'Klawiatura',
  keys: [
    ['1–7', 'wybór agenta'],
    ['strzałki, Enter', 'kursor, budowa lub wybór'],
    ['Spacja', 'start fali / pauza'],
    ['U, S, T', 'ulepsz, sprzedaj, zmień cel'],
    ['P', 'pauza'],
    ['F', 'prędkość gry'],
    ['Esc', 'anuluj'],
  ],
  levels: 'Poziomy',
  replay: 'Zagraj ponownie',
  notPlayed: 'jeszcze nierozegrany',
  starsLabel: (n) => `${n} z 3 gwiazdek`,
  starsRule: '3 gwiazdki: bez przecieków. 2 gwiazdki: co najmniej połowa rdzenia.',
  lives: 'Rdzeń',
  credits: 'Kredyty',
  wave: 'Fala',
  waveOf: (n, total) => `${n} / ${total}`,
  speed: 'Prędkość',
  pause: 'Pauza',
  resume: 'Wznów',
  paused: 'Pauza',
  restart: 'Od nowa',
  menu: 'Poziomy',
  help: 'Pomoc',
  close: 'Zamknij',
  langLabel: 'Język',
  build: 'Agenci',
  startWave: 'Start fali',
  waveRunning: 'Fala w toku',
  nextWave: 'Następna fala',
  laterWaves: 'Później',
  remaining: (n) => `zostało ${n}`,
  lastWave: 'Ostatnia fala',
  noMoreWaves: 'Wszystkie fale odparte',
  newHere: 'Nowość w tym poziomie',
  begin: 'Zacznij budować',
  cost: 'Koszt',
  damage: 'Obrażenia',
  rate: 'Strzały / s',
  range: 'Zasięg',
  chain: 'Łańcuch',
  blast: 'Promień wybuchu',
  slow: 'Spowolnienie',
  boost: 'Wzmocnienie',
  reveal: 'Zasięg wykrywania',
  deadZone: 'Martwa strefa',
  level: 'Poziom',
  upgrade: 'Ulepsz',
  maxed: 'Najwyższy poziom',
  sell: 'Sprzedaj',
  undo: 'Cofnij',
  target: 'Cel',
  dealt: 'Zadane obrażenia',
  kills: 'Zniszczone',
  boosted: (pct) => `+${pct}% od Latarni`,
  hp: 'Wytrzymałość',
  speedStat: 'Prędkość',
  armour: 'Pancerz',
  ignoresArmour: 'ignorowany',
  leak: 'Uszkodzenie rdzenia',
  bounty: 'Nagroda',
  selectHint: 'Wybierz agenta do zbudowania albo kliknij agenta na planszy.',
  modes: {
    first: 'Pierwszy',
    last: 'Ostatni',
    strong: 'Najsilniejszy',
    weak: 'Najsłabszy',
  },
  modeHelp: {
    first: 'najbliżej rdzenia',
    last: 'najdalej od rdzenia',
    strong: 'najwięcej wytrzymałości',
    weak: 'najmniej wytrzymałości',
  },
  placeErrors: {
    tile: 'Agenci stoją na gniazdach i posadzce; mury tylko na posadzce.',
    occupied: 'To pole jest zajęte.',
    blocks: 'To odcięłoby rdzeń. Zostaw usterkom przejście.',
    funds: 'Za mało kredytów.',
    locked: 'Niedostępne w tym poziomie.',
    over: 'Poziom jest zakończony.',
    wave: 'Labirynt na posadzce zmienia się tylko między falami. Gniazda są dostępne zawsze.',
  },
  traits: {
    armour: (n) => `pancerz ${n}`,
    cloaked: 'niewidzialny',
    splits: 'rozpada się',
    heals: 'leczy',
    boss: 'boss',
    fast: 'szybki',
  },
  victory: 'Rdzeń ocalał',
  defeat: 'Rdzeń stracony',
  victoryText: (lives, max) => `Rdzeń wytrzymał: zostało ${lives} z ${max}.`,
  defeatText: (wave, total) => `Usterki przebiły się w fali ${wave} z ${total}.`,
  defeatHint:
    'Zajrzyj jeszcze raz do listy fal: która usterka się przebiła i który agent na nią odpowiada?',
  nextLevel: 'Następny poziom',
  tryAgain: 'Spróbuj ponownie',
  backToLevels: 'Wszystkie poziomy',
  allDone: 'Wszystkie poziomy ukończone. Dziękuję za grę.',
  boardLabel: 'Plansza gry. Strzałki przesuwają kursor, Enter buduje albo wybiera agenta.',
  announce: {
    waveStart: (n) => `Fala ${n} rozpoczęła się.`,
    waveClear: (n, bonus) =>
      `Fala ${n} odparta. Premia: ${plural(bonus, 'pl', ['kredyt', 'kredyty', 'kredytów'])}.`,
    leak: (lives) => `Usterka dotarła do rdzenia. Zostało ${lives}.`,
    built: (name) => `Zbudowano: ${name}.`,
    upgraded: (name, level) => `${name}: poziom ${level}.`,
    sold: (n) => `Sprzedano za ${plural(n, 'pl', ['kredyt', 'kredyty', 'kredytów'])}.`,
    cursor: (x, y, what) => `Kolumna ${x + 1}, wiersz ${y + 1}: ${what}.`,
  },
  tiles: {
    '.': 'posadzka',
    '#': 'skała',
    '=': 'tor',
    '^': 'gniazdo',
    S: 'brama',
    C: 'rdzeń',
  },
  source: 'Kod źródłowy',
  towers: {
    pulse: { name: 'Puls', text: 'Tani, równy ogień w jeden cel. Pancerz prawie go nie czuje.' },
    arc: {
      name: 'Łuk',
      text: 'Wyładowanie skacze między usterkami, które idą blisko siebie. Stworzony do walki z rojami.',
    },
    lance: {
      name: 'Lanca',
      text: 'Wiązka przebija każdą usterkę na swojej linii i ignoruje pancerz. Wolna: ustaw ją wzdłuż prostego toru.',
    },
    mortar: {
      name: 'Moździerz',
      text: 'Wystrzeliwuje pocisk z wyprzedzeniem i razi cały obszar. Nie strzela do usterek tuż obok siebie.',
    },
    throttle: {
      name: 'Dławik',
      text: 'Spowalnia każdą usterkę w swoim polu. Pola się nie sumują: działa silniejsze.',
    },
    beacon: {
      name: 'Latarnia',
      text: 'Odsłania niewidzialne usterki w zasięgu i wzmacnia agentów na ośmiu polach wokół siebie. Wzmocnienia się sumują.',
    },
    wall: { name: 'Mur', text: 'Tania blokada na posadzkę. Służy do wydłużania trasy.' },
  },
  enemies: {
    spark: { name: 'Iskra', text: 'Zwykła usterka. Bez sztuczek.' },
    mite: { name: 'Pchła', text: 'Mała i szybka, przychodzi rojami.' },
    bulwark: {
      name: 'Bastion',
      text: 'Opancerzony: każde trafienie traci 6 obrażeń, więc drobne strzały ledwo go drapią.',
    },
    phantom: {
      name: 'Fantom',
      text: 'Niewidzialny: nic go nie trafi, dopóki Latarnia go nie odsłoni.',
    },
    splitter: { name: 'Dzielnik', text: 'Po zniszczeniu rozpada się na trzy Pchły.' },
    mender: {
      name: 'Medyk',
      text: 'Naprawia usterki wokół siebie. Potrzebny jest skupiony ogień albo wyeliminowanie go w pierwszej kolejności.',
    },
    colossus: {
      name: 'Kolos',
      text: 'Ciężki pancerz, ogromna wytrzymałość, spowolnienia działają na niego o połowę słabiej, osłania sąsiednie usterki.',
    },
  },
  levelCopy: {
    handshake: {
      name: 'Uzgadnianie',
      brief: 'Jeden tor, jeden rodzaj usterek. Znajdź pola, które pokrywają tor więcej niż raz.',
      focus: 'Puls: gniazdo przy zakręcie sięga dwóch odcinków toru.',
    },
    'fan-out': {
      name: 'Rozgałęzienie',
      brief: 'Tor czterokrotnie zawraca. Nadchodzą roje Pcheł.',
      focus:
        'Łuk: jedno wyładowanie trafia kilka usterek. Gniazda między dwoma torami pokrywają oba.',
    },
    bulwark: {
      name: 'Pancerz',
      brief: 'Bastiony ignorują drobne trafienia. Dwa długie, proste tory to Twoja szansa.',
      focus: 'Lanca: ignoruje pancerz i przebija całą linię. Wyceluj ją wzdłuż prostego toru.',
    },
    'open-floor': {
      name: 'Otwarta hala',
      brief: 'Tu nie ma torów: usterki idą najkrótszą drogą przez posadzkę. Wydłuż ją.',
      focus:
        'Mury i labirynty: każdy agent na posadzce zmienia trasę. Drogi nie da się zamknąć całkiem.',
    },
    'ghost-protocol': {
      name: 'Protokół widmo',
      brief: 'Fantomy są niewidoczne dla agentów. Bez Latarni przejdą bez przeszkód.',
      focus: 'Latarnia: odsłania niewidzialne usterki i wzmacnia agentów wokół siebie.',
    },
    'split-brain': {
      name: 'Rozszczepienie',
      brief: 'Zniszczony Dzielnik wypuszcza trzy Pchły. Spowolnij je i traf wszystkie naraz.',
      focus: 'Moździerz i Dławik: spowolnioną usterkę łatwo trafić pociskiem.',
    },
    'two-fronts': {
      name: 'Dwa fronty',
      brief:
        'Dwie bramy, jeden rdzeń, wszyscy agenci dostępni. Spraw, by trasy spotkały się tam, gdzie stoi obrona.',
      focus: 'Dwie bramy: każda ma własną trasę i obie zmieniają się, gdy budujesz.',
    },
    'field-medics': {
      name: 'Medycy polowi',
      brief: 'Medycy naprawiają usterki wokół siebie. Równy ogień nie nadąży.',
      focus: 'Medyk: skup obrażenia, użyj Lancy i Moździerza, dobieraj cele.',
    },
    'tight-budget': {
      name: 'Napięty budżet',
      brief:
        'Siedem gniazd, dziesięć punktów rdzenia, wszystkie rodzaje usterek. Każdy kredyt ma jedno dobre miejsce.',
      focus: 'Łamigłówka: mało gniazd, mieszane fale. Zaplanuj cały poziom przed pierwszą falą.',
    },
    colossus: {
      name: 'Kolos',
      brief: 'Nadchodzi coś dużego, co osłania swoją eskortę. Wszystko, co już wiesz, naraz.',
      focus:
        'Kolos: ciężki pancerz, ogromna wytrzymałość, odporny na spowolnienia, osłania sąsiadów.',
    },
  },
};

const STRINGS: Record<Lang, Strings> = { en, pl };

export function strings(lang: Lang): Strings {
  return STRINGS[lang];
}
