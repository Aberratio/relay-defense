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
  title: 'Heartwood',
  tagline: 'A tower defense game that rewards a plan over reflexes.',
  intro:
    'Monsters pour out of the portals towards the Heart Tree. Place defenders on the stone circles and the open meadow, read every wave before it starts and choose the right answer to each threat. The game waits for you between waves.',
  howTitle: 'How to play',
  how: [
    'Pick a defender in the panel, then click a free stone circle or meadow tile. Defenders on the meadow are part of the maze: the monsters walk around them.',
    'The dashed line is the current route. While placing, the preview shows how the route would change.',
    'Every wave is listed before it starts. Check what is coming, then press Start wave.',
    'Click a defender to upgrade it, sell it or change what it aims at. Selling in the same build phase refunds everything.',
  ],
  keysTitle: 'Keyboard',
  keys: [
    ['1–7', 'pick a defender'],
    ['arrows, Enter', 'move the cursor, place or select'],
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
  starsRule: '3 stars: no monster gets through. 2 stars: the tree keeps at least half its life.',
  play: (name: string) => `Play: ${name}`,
  starsTotal: (n: number, total: number) => `${n} of ${total} stars`,
  locked: 'locked',
  lockedHint: (n: number) => `This level opens once you win level ${n}.`,
  progressTitle: 'Levels and progress',
  unlockRule:
    'The first three levels are open. Winning a level opens the next one. The Siege is open from the start.',
  unlockAll: 'Unlock all levels',
  lockAgain: 'Lock the levels again',
  allOpen: 'All levels are open.',
  locksBack: 'The levels are locked again.',
  lives: 'Life',
  credits: 'Gold',
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
  build: 'Defenders',
  startWave: 'Start wave',
  waveRunning: 'Wave in progress',
  nextWave: 'Next wave',
  laterWaves: 'Later',
  remaining: (n: number) => `${n} left`,
  lastWave: 'Final wave',
  noMoreWaves: 'All waves held off',
  newHere: 'New in this level',
  begin: 'Start building',
  cost: 'Cost',
  damage: 'Damage',
  rate: 'Shots / s',
  range: 'Range',
  chain: 'Chain',
  blast: 'Impact radius',
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
  boosted: (pct: number) => `+${pct}% from Lantern Fairies`,
  hp: 'Life',
  speedStat: 'Speed',
  armour: 'Armour',
  ignoresArmour: 'ignored',
  leak: 'Damage to the tree',
  bounty: 'Bounty',
  selectHint: 'Pick a defender to place, or click one on the board.',
  modes: {
    first: 'First',
    last: 'Last',
    strong: 'Strongest',
    weak: 'Weakest',
  } satisfies Record<TargetMode, string>,
  modeHelp: {
    first: 'closest to the tree',
    last: 'furthest from the tree',
    strong: 'most life',
    weak: 'least life',
  } satisfies Record<TargetMode, string>,
  placeErrors: {
    tile: 'Defenders stand on stone circles and the meadow; Thorns only on the meadow.',
    occupied: 'This tile is taken.',
    blocks: 'That would cut the tree off. Leave the monsters a way through.',
    funds: 'Not enough gold.',
    locked: 'Not available in this level.',
    over: 'The level is over.',
    wave: 'The maze on the meadow changes only between waves. Stone circles stay open.',
  } satisfies Record<PlaceError, string>,
  traits: {
    armour: (n: number) => `armour ${n}`,
    cloaked: 'invisible',
    splits: 'splits',
    heals: 'heals',
    boss: 'boss',
    fast: 'fast',
  },
  victory: 'The tree stands',
  defeat: 'The tree has fallen',
  victoryText: (lives: number, max: number) =>
    `The Heart Tree stands with ${lives} of ${max} life.`,
  defeatText: (wave: number, total: number) =>
    `The monsters broke through in wave ${wave} of ${total}.`,
  defeatHint:
    'Look at the wave list again: which monster got through, and which defender answers it?',
  nextLevel: 'Next level',
  tryAgain: 'Try again',
  backToLevels: 'All levels',
  allDone: 'Every level cleared. Thank you for playing.',
  boardLabel:
    'Game board. Use the arrow keys to move the cursor and Enter to place or select a defender.',
  announce: {
    waveStart: (n: number) => `Wave ${n} started.`,
    waveClear: (n: number, bonus: number) =>
      `Wave ${n} held off. Bonus ${plural(bonus, 'en', ['coin', 'coins', 'coins'])}.`,
    leak: (lives: number) => `A monster reached the tree. Life ${lives}.`,
    built: (name: string) => `${name} placed.`,
    upgraded: (name: string, level: number) => `${name} upgraded to level ${level}.`,
    sold: (credits: number) => `Sold for ${plural(credits, 'en', ['coin', 'coins', 'coins'])}.`,
    cursor: (x: number, y: number, what: string) => `Column ${x + 1}, row ${y + 1}: ${what}.`,
  },
  tiles: {
    '.': 'meadow',
    '#': 'rock',
    '=': 'path',
    '^': 'stone circle',
    S: 'portal',
    C: 'Heart Tree',
  } as Record<string, string>,
  source: 'Source code',
  towers: {
    pulse: {
      name: 'Archer',
      text: 'Cheap and steady arrows at one target. Armour shrugs them off.',
    },
    arc: {
      name: 'Druid',
      text: 'Calls lightning that jumps between monsters walking close together. Made for swarms.',
    },
    lance: {
      name: 'Unicorn',
      text: 'A beam from the horn that pierces every monster on its line and ignores armour. Slow: line it up with a straight path.',
    },
    mortar: {
      name: 'Ent',
      text: 'Hurls a boulder that leads its target and hits an area. Cannot throw at monsters right next to it.',
    },
    throttle: {
      name: 'Dryad',
      text: 'Her roots slow every monster in her field. Two fields do not stack: the stronger one applies.',
    },
    beacon: {
      name: 'Lantern Fairy',
      text: 'Her light reveals invisible monsters in range and boosts the damage of the defenders on the eight tiles around her. Boosts from several fairies add up.',
    },
    wall: {
      name: 'Thorns',
      text: 'A cheap hedge for the meadow. Use it to make the route longer.',
    },
  } satisfies Record<TowerKind, Named>,
  enemies: {
    spark: { name: 'Goblin', text: 'A plain monster. No tricks.' },
    mite: { name: 'Spiderling', text: 'Tiny and fast, and it comes in swarms.' },
    bulwark: {
      name: 'Troll',
      text: 'Armoured: every hit loses 6 damage, so small hits barely scratch it.',
    },
    phantom: {
      name: 'Wraith',
      text: 'Invisible: nothing can hit it unless a Lantern Fairy reveals it.',
    },
    splitter: { name: 'Brood Mother', text: 'Bursts into three Spiderlings when she falls.' },
    mender: {
      name: 'Shaman',
      text: 'Heals the monsters around him. Bring burst damage, or take him out first.',
    },
    colossus: {
      name: 'Ogre Warlord',
      text: 'Heavy armour, a huge pool of life, half as affected by slows, and he shields the monsters next to him.',
    },
  } satisfies Record<EnemyKind, Named>,
  levelCopy: {
    handshake: {
      name: 'First Watch',
      brief:
        'A single path, a single kind of monster. Find the tiles that cover the path more than once.',
      focus: 'Archers. A stone circle next to a bend reaches two stretches of the path.',
    },
    'fan-out': {
      name: 'Winding Brook',
      brief: 'The path folds back on itself four times. Swarms of Spiderlings are coming.',
      focus:
        'Druid: one bolt of lightning reaches several monsters. Circles between two paths cover both.',
    },
    bulwark: {
      name: 'Iron Hides',
      brief: 'Trolls shrug off small hits. Two long straight paths are your chance.',
      focus: 'Unicorn: ignores armour and pierces the whole line. Point it down a straight path.',
    },
    'open-floor': {
      name: 'Open Meadow',
      brief: 'No paths here: the monsters take the shortest way across the meadow. Make it long.',
      focus:
        'Thorns and mazes: every defender on the meadow reroutes the monsters. You cannot close the way completely.',
    },
    'ghost-protocol': {
      name: 'Mist Walkers',
      brief:
        'Wraiths are invisible to your defenders. Without a Lantern Fairy they walk straight in.',
      focus: 'Lantern Fairy: reveals invisible monsters and strengthens the defenders around her.',
    },
    'split-brain': {
      name: 'The Brood',
      brief:
        'Fell a Brood Mother and three Spiderlings spill out. Slow them down and hit them all at once.',
      focus: 'Ent and Dryad: a slowed monster is easy to hit with a boulder.',
    },
    'two-fronts': {
      name: 'Two Fronts',
      brief:
        'Two portals, one tree, every defender available. Make the routes meet where your defence is.',
      focus: 'Two portals: each has its own route, and both change as you build.',
    },
    'field-medics': {
      name: "Shaman's Chant",
      brief: 'Shamans heal the monsters around them. Steady fire will not keep up.',
      focus: 'Shaman: concentrate damage, use the Unicorn and the Ent, and pick targets.',
    },
    'tight-budget': {
      name: 'Lean Winter',
      brief: 'Seven stone circles, ten life, every kind of monster. Each coin has one right place.',
      focus: 'A puzzle: few circles, mixed waves. Plan the whole level before the first wave.',
    },
    colossus: {
      name: 'Ogre Warlord',
      brief:
        'Something big is coming, and it shields its escort. Everything you have learned, at once.',
      focus: 'Ogre Warlord: heavy armour, huge life, resists slows, shields his neighbours.',
    },
  } satisfies Record<string, LevelCopy>,
  siege: {
    title: 'Siege',
    tagline:
      'One meadow, five chapters. Your defenders stay where you put them, and every chapter brings a new hardship.',
    hint: 'For seasoned players',
    begin: 'Begin the siege',
    resume: (n: number) => `Continue with chapter ${n}`,
    again: 'Start the siege over',
    won: 'Siege broken',
    chapter: (n: number, total: number) => `Siege · chapter ${n} / ${total}`,
    short: (n: number) => `Siege ${n}`,
    chapterLabel: (n: number, stars: number) => `Chapter ${n}: ${stars} of 3 stars`,
    chapterOpen: (n: number) => `Chapter ${n}: not won yet`,
    now: 'What changes now',
    next: 'In the next chapter',
    review:
      'Before the first wave every defender you brought sells back at full value, so you can rework the whole defence.',
    topUp: (n: number) =>
      `The Heart Tree adds ${n} gold, so your defence is worth at least what this chapter asks.`,
    rules:
      'Defenders and gold carry over to the next chapter. A defeat sends you back to the start of the chapter.',
    nextChapter: 'Next chapter',
    retry: 'Retry the chapter',
    allDone: 'The siege is broken and the Heart Tree stands. Thank you for playing.',
    fog: (pct: number) => `In fog: ${pct}% of the range`,
    tiles: {
      fog: 'in fog',
      fogLater: 'fog comes here later',
      cracked: 'cracked, it will collapse',
      dormant: 'sleeping portal',
    },
    ahead: 'What the siege brings',
    chapters: {
      awakening: {
        name: 'Awakening',
        brief:
          'A ridge splits the meadow and one narrow pass leads through it. A second portal sleeps on the southern edge.',
        focus:
          'Build for the whole siege: the sleeping portal and the cracked pass already count, so the monsters must keep a way from both.',
      },
      'second-portal': {
        name: 'Second Portal',
        brief:
          'The southern portal wakes. Monsters now come from two sides, and the southern ones start close to the tree.',
        focus: 'A second portal opens on the southern edge.',
      },
      landslide: {
        name: 'Landslide',
        brief:
          'The pass through the ridge has collapsed. Monsters from the west now go round through the gap in the south.',
        focus: 'The pass through the ridge collapses and the routes change.',
      },
      fog: {
        name: 'Fog',
        brief: 'Fog rolls over the south-east of the meadow, where the two routes meet.',
        focus: 'Fog covers the south-east and shortens the reach of every defender standing in it.',
      },
      warlord: {
        name: 'The Warlord',
        brief:
          'The Ogre Warlord leads the last assault, and his monsters have hardened their hides.',
        focus: 'The Ogre Warlord comes, and every monster gains 2 armour.',
      },
    } satisfies Record<string, LevelCopy>,
  },
};

export type Strings = typeof en;

/** A number with the plural form a language picks for it: forms for "one", "few" and "many". */
function plural(n: number, lang: Lang, forms: [string, string, string]): string {
  const form = new Intl.PluralRules(lang).select(n);
  return `${n} ${form === 'one' ? forms[0] : form === 'few' ? forms[1] : forms[2]}`;
}

const pl: Strings = {
  title: 'Heartwood',
  tagline: 'Gra typu tower defense, w której plan wygrywa z refleksem.',
  intro:
    'Potwory wylewają się z portali i idą w stronę Drzewa Serca. Ustawiaj obrońców w kamiennych kręgach i na otwartej łące, czytaj każdą falę przed startem i dobieraj właściwą odpowiedź na każde zagrożenie. Między falami gra czeka na Ciebie.',
  howTitle: 'Jak grać',
  how: [
    'Wybierz obrońcę w panelu i kliknij wolny kamienny krąg albo pole łąki. Obrońcy na łące tworzą labirynt: potwory muszą ich obejść.',
    'Przerywana linia to aktualna trasa. Podczas stawiania podgląd pokazuje, jak trasa się zmieni.',
    'Każda fala jest opisana przed startem. Sprawdź, co nadchodzi, i naciśnij Start fali.',
    'Kliknij obrońcę, aby go ulepszyć, sprzedać albo zmienić cel. Sprzedaż w tej samej fazie budowy zwraca całość.',
  ],
  keysTitle: 'Klawiatura',
  keys: [
    ['1–7', 'wybór obrońcy'],
    ['strzałki, Enter', 'kursor, ustawienie lub wybór'],
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
  starsRule:
    '3 gwiazdki: żaden potwór nie przejdzie. 2 gwiazdki: Drzewu zostaje co najmniej połowa życia.',
  play: (name) => `Graj: ${name}`,
  starsTotal: (n, total) => `${n} z ${total} gwiazdek`,
  locked: 'zablokowany',
  lockedHint: (n) => `Ten poziom otworzy się po wygraniu poziomu ${n}.`,
  progressTitle: 'Poziomy i postęp',
  unlockRule:
    'Pierwsze trzy poziomy są otwarte. Wygrana otwiera kolejny poziom. Oblężenie jest dostępne od początku.',
  unlockAll: 'Odblokuj wszystkie poziomy',
  lockAgain: 'Przywróć blokady poziomów',
  allOpen: 'Wszystkie poziomy są otwarte.',
  locksBack: 'Poziomy znów są zablokowane.',
  lives: 'Życie',
  credits: 'Złoto',
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
  build: 'Obrońcy',
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
  blast: 'Promień uderzenia',
  slow: 'Spowolnienie',
  boost: 'Wzmocnienie',
  reveal: 'Zasięg światła',
  deadZone: 'Martwa strefa',
  level: 'Poziom',
  upgrade: 'Ulepsz',
  maxed: 'Najwyższy poziom',
  sell: 'Sprzedaj',
  undo: 'Cofnij',
  target: 'Cel',
  dealt: 'Zadane obrażenia',
  kills: 'Pokonane',
  boosted: (pct) => `+${pct}% od Wróżek`,
  hp: 'Życie',
  speedStat: 'Prędkość',
  armour: 'Pancerz',
  ignoresArmour: 'ignorowany',
  leak: 'Strata życia Drzewa',
  bounty: 'Nagroda',
  selectHint: 'Wybierz obrońcę do ustawienia albo kliknij obrońcę na planszy.',
  modes: {
    first: 'Pierwszy',
    last: 'Ostatni',
    strong: 'Najsilniejszy',
    weak: 'Najsłabszy',
  },
  modeHelp: {
    first: 'najbliżej Drzewa',
    last: 'najdalej od Drzewa',
    strong: 'najwięcej życia',
    weak: 'najmniej życia',
  },
  placeErrors: {
    tile: 'Obrońcy stoją w kamiennych kręgach i na łące; Ciernie tylko na łące.',
    occupied: 'To pole jest zajęte.',
    blocks: 'To odcięłoby Drzewo. Zostaw potworom przejście.',
    funds: 'Za mało złota.',
    locked: 'Niedostępne w tym poziomie.',
    over: 'Poziom jest zakończony.',
    wave: 'Labirynt na łące zmienia się tylko między falami. Kamienne kręgi są dostępne zawsze.',
  },
  traits: {
    armour: (n) => `pancerz ${n}`,
    cloaked: 'niewidzialny',
    splits: 'rozpada się',
    heals: 'leczy',
    boss: 'boss',
    fast: 'szybki',
  },
  victory: 'Drzewo ocalało',
  defeat: 'Drzewo upadło',
  victoryText: (lives, max) =>
    `Drzewo Serca przetrwało: zostało mu ${lives} z ${max} punktów życia.`,
  defeatText: (wave, total) => `Potwory przebiły się w fali ${wave} z ${total}.`,
  defeatHint:
    'Zajrzyj jeszcze raz do listy fal: który potwór się przebił i który obrońca na niego odpowiada?',
  nextLevel: 'Następny poziom',
  tryAgain: 'Spróbuj ponownie',
  backToLevels: 'Wszystkie poziomy',
  allDone: 'Wszystkie poziomy ukończone. Dziękuję za grę.',
  boardLabel: 'Plansza gry. Strzałki przesuwają kursor, Enter ustawia albo wybiera obrońcę.',
  announce: {
    waveStart: (n) => `Fala ${n} rozpoczęła się.`,
    waveClear: (n, bonus) =>
      `Fala ${n} odparta. Premia: ${plural(bonus, 'pl', ['moneta', 'monety', 'monet'])}.`,
    leak: (lives) => `Potwór dotarł do Drzewa. Życie: ${lives}.`,
    built: (name) => `Ustawiono: ${name}.`,
    upgraded: (name, level) => `${name}: poziom ${level}.`,
    sold: (n) => `Sprzedano za ${plural(n, 'pl', ['monetę', 'monety', 'monet'])}.`,
    cursor: (x, y, what) => `Kolumna ${x + 1}, wiersz ${y + 1}: ${what}.`,
  },
  tiles: {
    '.': 'łąka',
    '#': 'skała',
    '=': 'ścieżka',
    '^': 'kamienny krąg',
    S: 'portal',
    C: 'Drzewo Serca',
  },
  source: 'Kod źródłowy',
  towers: {
    pulse: {
      name: 'Łuczniczka',
      text: 'Tanie, równe strzały w jeden cel. Pancerz prawie ich nie czuje.',
    },
    arc: {
      name: 'Druid',
      text: 'Przywołuje piorun, który skacze między potworami idącymi blisko siebie. Stworzony do walki z rojami.',
    },
    lance: {
      name: 'Jednorożec',
      text: 'Promień z rogu przebija każdego potwora na swojej linii i ignoruje pancerz. Strzela wolno: ustaw go wzdłuż prostej ścieżki.',
    },
    mortar: {
      name: 'Ent',
      text: 'Rzuca głazem z wyprzedzeniem i razi cały obszar. Nie rzuca w potwory tuż obok siebie.',
    },
    throttle: {
      name: 'Driada',
      text: 'Jej korzenie spowalniają każdego potwora w zasięgu. Pola się nie sumują: działa silniejsze.',
    },
    beacon: {
      name: 'Wróżka',
      text: 'Jej światło odsłania niewidzialne potwory w zasięgu i wzmacnia obrażenia obrońców na ośmiu polach wokół niej. Wzmocnienia od kilku Wróżek się sumują.',
    },
    wall: { name: 'Ciernie', text: 'Tani żywopłot na łąkę. Służy do wydłużania trasy.' },
  },
  enemies: {
    spark: { name: 'Goblin', text: 'Zwykły potwór. Bez sztuczek.' },
    mite: { name: 'Pajączek', text: 'Mały i szybki, przychodzi rojami.' },
    bulwark: {
      name: 'Troll',
      text: 'Opancerzony: każde trafienie traci 6 obrażeń, więc drobne strzały ledwo go drapią.',
    },
    phantom: {
      name: 'Upiór',
      text: 'Niewidzialny: nic go nie trafi, dopóki Wróżka go nie odsłoni.',
    },
    splitter: { name: 'Pajęczyca', text: 'Pokonana rozpada się na trzy Pajączki.' },
    mender: {
      name: 'Szaman',
      text: 'Leczy potwory wokół siebie. Potrzebny jest skupiony ogień albo wyeliminowanie go w pierwszej kolejności.',
    },
    colossus: {
      name: 'Wódz ogrów',
      text: 'Ciężki pancerz, ogromny zapas życia, spowolnienia działają na niego o połowę słabiej, osłania sąsiednie potwory.',
    },
  },
  levelCopy: {
    handshake: {
      name: 'Pierwsza warta',
      brief:
        'Jedna ścieżka, jeden rodzaj potworów. Znajdź pola, które pokrywają ścieżkę więcej niż raz.',
      focus: 'Łuczniczki: krąg przy zakręcie sięga dwóch odcinków ścieżki.',
    },
    'fan-out': {
      name: 'Kręty strumień',
      brief: 'Ścieżka czterokrotnie zawraca. Nadchodzą roje Pajączków.',
      focus:
        'Druid: jeden piorun trafia kilka potworów. Kręgi między dwiema ścieżkami pokrywają obie.',
    },
    bulwark: {
      name: 'Żelazne skóry',
      brief: 'Trolle ignorują drobne trafienia. Dwie długie, proste ścieżki to Twoja szansa.',
      focus: 'Jednorożec: ignoruje pancerz i przebija całą linię. Ustaw go wzdłuż prostej ścieżki.',
    },
    'open-floor': {
      name: 'Otwarta łąka',
      brief: 'Tu nie ma ścieżek: potwory idą najkrótszą drogą przez łąkę. Wydłuż ją.',
      focus:
        'Ciernie i labirynty: każdy obrońca na łące zmienia trasę. Drogi nie da się zamknąć całkiem.',
    },
    'ghost-protocol': {
      name: 'Kroczący we mgle',
      brief: 'Upiory są niewidoczne dla obrońców. Bez Wróżki przejdą bez przeszkód.',
      focus: 'Wróżka: odsłania niewidzialne potwory i wzmacnia obrońców wokół siebie.',
    },
    'split-brain': {
      name: 'Wylęgarnia',
      brief: 'Pokonana Pajęczyca wypuszcza trzy Pajączki. Spowolnij je i traf wszystkie naraz.',
      focus: 'Ent i Driada: spowolnionego potwora łatwo trafić głazem.',
    },
    'two-fronts': {
      name: 'Dwa fronty',
      brief:
        'Dwa portale, jedno Drzewo, wszyscy obrońcy dostępni. Spraw, by trasy spotkały się tam, gdzie stoi obrona.',
      focus: 'Dwa portale: każdy ma własną trasę i obie zmieniają się, gdy budujesz.',
    },
    'field-medics': {
      name: 'Pieśń szamana',
      brief: 'Szamani leczą potwory wokół siebie. Równy ogień nie nadąży.',
      focus: 'Szaman: skup obrażenia, użyj Jednorożca i Enta, dobieraj cele.',
    },
    'tight-budget': {
      name: 'Chuda zima',
      brief:
        'Siedem kamiennych kręgów, dziesięć punktów życia, wszystkie rodzaje potworów. Każda moneta ma jedno dobre miejsce.',
      focus: 'Łamigłówka: mało kręgów, mieszane fale. Zaplanuj cały poziom przed pierwszą falą.',
    },
    colossus: {
      name: 'Wódz ogrów',
      brief: 'Nadchodzi coś dużego, co osłania swoją eskortę. Wszystko, co już wiesz, naraz.',
      focus:
        'Wódz ogrów: ciężki pancerz, ogromny zapas życia, odporny na spowolnienia, osłania sąsiadów.',
    },
  },
  siege: {
    title: 'Oblężenie',
    tagline:
      'Jedna łąka, pięć rozdziałów. Obrońcy zostają tam, gdzie ich postawisz, a każdy rozdział przynosi nowe utrudnienie.',
    hint: 'Dla zaawansowanych',
    begin: 'Rozpocznij oblężenie',
    resume: (n) => `Graj dalej: rozdział ${n}`,
    again: 'Zacznij oblężenie od nowa',
    won: 'Oblężenie odparte',
    chapter: (n, total) => `Oblężenie · rozdział ${n} / ${total}`,
    short: (n) => `Oblężenie ${n}`,
    chapterLabel: (n, stars) => `Rozdział ${n}: ${stars} z 3 gwiazdek`,
    chapterOpen: (n) => `Rozdział ${n}: jeszcze niewygrany`,
    now: 'Co się zmienia teraz',
    next: 'W następnym rozdziale',
    review:
      'Przed pierwszą falą każdy przeniesiony obrońca sprzedaje się za pełną wartość, więc możesz przebudować całą obronę.',
    topUp: (n) =>
      `Drzewo Serca dokłada ${n} złota, żeby Twoja obrona była warta co najmniej tyle, ile wymaga ten rozdział.`,
    rules:
      'Obrońcy i złoto przechodzą do następnego rozdziału. Porażka cofa Cię na początek rozdziału.',
    nextChapter: 'Następny rozdział',
    retry: 'Powtórz rozdział',
    allDone: 'Oblężenie odparte, Drzewo Serca ocalało. Dziękuję za grę.',
    fog: (pct) => `We mgle: ${pct}% zasięgu`,
    tiles: {
      fog: 'we mgle',
      fogLater: 'tu później nadejdzie mgła',
      cracked: 'popękana, zawali się',
      dormant: 'uśpiony portal',
    },
    ahead: 'Co przyniesie oblężenie',
    chapters: {
      awakening: {
        name: 'Przebudzenie',
        brief:
          'Grań dzieli łąkę, a przez nią prowadzi jedna wąska przełęcz. Na południowym skraju śpi drugi portal.',
        focus:
          'Buduj z myślą o całym oblężeniu: uśpiony portal i popękana przełęcz już się liczą, więc potwory muszą mieć drogę od obu.',
      },
      'second-portal': {
        name: 'Drugi portal',
        brief:
          'Budzi się południowy portal. Potwory nadchodzą z dwóch stron, a te z południa startują blisko Drzewa.',
        focus: 'Na południowym skraju otwiera się drugi portal.',
      },
      landslide: {
        name: 'Osuwisko',
        brief:
          'Przełęcz w grani się zawaliła. Potwory z zachodu obchodzą ją teraz przez przerwę na południu.',
        focus: 'Przełęcz w grani się zawala i trasy się zmieniają.',
      },
      fog: {
        name: 'Mgła',
        brief:
          'Mgła spływa na południowo-wschodnią część łąki, tam, gdzie spotykają się obie trasy.',
        focus: 'Mgła okrywa południowy wschód i skraca zasięg każdego obrońcy, który w niej stoi.',
      },
      warlord: {
        name: 'Wódz',
        brief: 'Wódz ogrów prowadzi ostatni szturm, a jego potwory mają stwardniałe skóry.',
        focus: 'Nadchodzi Wódz ogrów, a każdy potwór zyskuje 2 punkty pancerza.',
      },
    },
  },
};

const STRINGS: Record<Lang, Strings> = { en, pl };

export function strings(lang: Lang): Strings {
  return STRINGS[lang];
}
