/* ------------------------------------------------------------------------------------
   Timeline content, laid out in grid cells.

   The story is told place by place (ERAS). Each place is a block: its heading, then its
   cards, every card 4 x 4 cells with one empty cell between cards. The year axis is even:
   every year is ROWS_PER_YEAR cells (chosen so Berlin, with its five cards and five years,
   fits on one screen). A place's line runs straight to the year it began when the cards
   above leave room; otherwise it sits PLACE_GAP rows under the last card above and bends
   up to its year. The last place ends at the end of the axis: its last card's bottom on
   today's year, where the story stops level with the bottom of the map. When the story stops after a place, everything is drawn to the end of that
   place's cards and of its time, whichever is later.

   To add a job: add a card to its place (and its bar in BAR_YEARS, in years).
   ------------------------------------------------------------------------------------ */

export interface Txt { en: string; de: string; }

/** edu = grey box, work = green box, other = framed white box (languages, internships…) */
export type CardKind = 'edu' | 'work' | 'other';

export type Place = 'syria' | 'russia' | 'norway' | 'ludwigshafen' | 'stuttgart' | 'berlin';

/** map frame (map.json, 24 fps) that shows each place */
export const PLACE_FRAME: Record<Place, number> = {
  syria: 50, russia: 190, norway: 290, ludwigshafen: 355, stuttgart: 420, berlin: 560,
};

export interface TlCard {
  y: number;              // top row (cells), set by the layout
  place: Place;
  bar: number;            // its duration bar: index in BARS
  kind: CardKind;
  logo: string;           // assets/images/timeline/<logo>.webp
  title: Txt;
  sub: Txt;
  desc?: Txt;             // cards with a picture: title, role and a short text
  more?: Txt;             // shown when the card is opened (cards with a desc show that)
}

/** until: the last place it belongs to — a country stays lit through all its cities */
export interface TlHeading { y: number; at: number; place: Place; until: Place; city?: boolean; label: Txt; }

/** Duration bars right of the cards: column 16 / 18 = work, column 20 = education & other */
export interface TlBar {
  col: number;
  y0: number;             // top row
  y1: number;             // bottom row (exclusive)
  kind: 'work' | 'edu' | 'other';
  cap?: 'up' | 'down';    // arrow: started before the axis / still ongoing
}

/** Connector lines from a country heading to the year axis (axis-aligned segments, cells) */
export interface TlSegment { x0: number; y0: number; x1: number; y1: number; }
export interface TlConnector { at: number; node?: number; place: Place; until: Place; segments: TlSegment[]; }

export const t = (en: string, de: string = en): Txt => ({ en, de });

type CardData = Omit<TlCard, 'y' | 'place'>;
interface Era {
  place: Place;
  /** country heading (a line runs from it to the axis) */
  country?: Txt;
  /** city under the country, or on its own inside a country already named */
  city?: Txt;
  /** the year this place began on the axis */
  from: number;
  /** Syria only: the axis jumps from `from` (1989, birth) to this year at the first card */
  cardsFrom?: number;
  cards: CardData[];
}

// exported for the Telegram bot's content (emil-server/scripts/bot-content.mjs)
export const ERAS: Era[] = [
  {
    place: 'syria', country: t('SYRIA', 'SYRIEN'), from: 1989, cardsFrom: 2008, cards: [
      { bar: 9, kind: 'edu', logo: 'tishreen',
        title: t('Bachelor degree in architecture', 'Bachelor in Architektur'),
        sub: t('TU | Latakia-Syria (2008-2013)', 'TU | Latakia-Syrien (2008-2013)'),
        more: t('Five years of architecture at Tishreen University in Latakia, 2008 to 2013. My graduation project was a science centre: research, learning and public exhibitions under one roof.',
                'Fünf Jahre Architekturstudium an der Tishreen-Universität in Latakia, 2008 bis 2013. Mein Abschlussprojekt war ein Wissenschaftszentrum: Forschung, Lehre und öffentliche Ausstellungen unter einem Dach.') },
      { bar: 0, kind: 'work', logo: 'tarek-jeffe',
        // "3D artist" / "3D-Artist" kept on one row (Emil 23 Oct): \u00a0, and \u2060 after a hyphen
        title: t('Architect assistant-3D\u00a0artist', 'Architekturassistent-3D-\u2060Artist'),
        sub: t('Tarek Jeffe arch-practice (2008-2013)', 'Architekturbüro Tarek Jeffe (2008-2013)'),
        more: t('I started here as a freelancer, then the office took me on. I designed many apartments and interiors and worked on buildings and competitions, all alongside my studies, so I saw the practical side of architecture early on.',
                'Ich habe hier als Freelancer angefangen, dann hat mich das Büro angestellt. Ich habe viele Wohnungen und Innenräume gestaltet und an Gebäuden und Wettbewerben gearbeitet, alles neben dem Studium. So habe ich die Praxis früh kennengelernt.') },
    ],
  },
  {
    place: 'russia', country: t('RUSSIA', 'RUSSLAND'), from: 2013.5, cards: [
      { bar: 10, kind: 'other', logo: 'rudn',
        title: t('C1 degree in Russian language', 'C1-Zertifikat Russisch'),
        sub: t('RUDN | Moscow-Russia (2013-2014)', 'RUDN | Moskau-Russland (2013-2014)'),
        more: t('A year at the language faculty of the Peoples’ Friendship University of Russia (RUDN) in Moscow. The C1 certificate in Russian qualified me to study at the university.',
                'Ein Jahr an der Sprachfakultät der Universität der Völkerfreundschaft (RUDN) in Moskau. Das C1-Zertifikat in Russisch hat mich für das Studium an der Universität qualifiziert.') },
      { bar: 1, kind: 'work', logo: 'antonio-partners',
        title: t('Interior architect', 'Innenarchitekt'),
        sub: t('Antonio & Partners (2014-2015)'),
        more: t('Interiors in Russia with an international office: restaurants, villas, houses and commercial spaces.',
                'Innenräume in Russland mit einem internationalen Büro: Restaurants, Villen, Wohnhäuser und Gewerbeflächen.') },
      { bar: 11, kind: 'edu', logo: 'rudn',
        title: t('Architectural design course', 'Kurs Architekturentwurf'),
        sub: t('RUDN | Moscow-Russia (2013-2014)', 'RUDN | Moskau-Russland (2013-2014)'),
        more: t('Design studios at RUDN in Moscow: architectural design in a new language and a new school of thought, with fellow students from all over the world.',
                'Entwurfsstudios an der RUDN in Moskau: Architekturentwurf in einer neuen Sprache und einer neuen Denkschule, mit Kommilitonen aus aller Welt.') },
      { bar: 7, kind: 'work', logo: 'ecostroy',
        title: t('Architect', 'Architekt'),
        sub: t('Ecostroy (2015)'),
        more: t('Architect and designer at Ecostroy, an office for ecological, sustainable architecture. We designed and realised private, governmental and cultural projects, from the concept to the building site.',
                'Architekt und Designer bei Ecostroy, einem Büro für ökologische, nachhaltige Architektur. Wir haben private, staatliche und kulturelle Projekte entworfen und umgesetzt, vom Konzept bis zur Baustelle.') },
    ],
  },
  {
    place: 'norway', country: t('NORWAY', 'NORWEGEN'), from: 2015.75, cards: [
      { bar: 12, kind: 'other', logo: 'teknoparken',
        title: t('Design apprentice', 'Design-Praktikant'),
        sub: t('Teknoparken Helgeland (2015)'),
        more: t('A few months as a design apprentice in Norway. I learned a lot about Scandinavian design, its simplicity and care for materials, and made connections that still matter to me.',
                'Einige Monate als Design-Praktikant in Norwegen. Ich habe viel über skandinavisches Design gelernt, seine Einfachheit und den Umgang mit Material, und Kontakte geknüpft, die mir bis heute wichtig sind.') },
    ],
  },
  {
    place: 'ludwigshafen', country: t('GERMANY', 'DEUTSCHLAND'), city: t('LUDWIGSHAFEN AM RHEIN'), from: 2016.5, cards: [
      { bar: 13, kind: 'other', logo: 'kreativlabor42',
        // a long word breaks only as "Architektur-" / "praktikant" (\u00ad, Emil 23 Oct)
        title: t('Architectural intern', 'Architektur\u00adpraktikant'),
        sub: t('kreativLABOR42 (2016)'),
        more: t('My first contact with the German market: six months alongside architects in Ludwigshafen, learning how projects are planned and built here. It’s where I found my way in Germany.',
                'Mein erster Kontakt mit dem deutschen Markt: sechs Monate an der Seite von Architekten in Ludwigshafen, um zu lernen, wie hier geplant und gebaut wird. Hier habe ich meinen Weg in Deutschland gefunden.') },
      { bar: 2, kind: 'work', logo: 'northwind',
        title: t('Mo. graphics designer-3D\u00a0artist', 'Motion-Designer-3D-\u2060Artist'),
        sub: t('Northwind Visuals (2016-2018)'),
        more: t('My first full-time job in Germany, which I got through my 3D and motion graphics skills. At a film studio, alongside filmmakers, I made motion graphics and illustrations, bringing geometry, order and proportion from architecture into the work.',
                'Mein erster Vollzeitjob in Deutschland, den ich durch meine 3D- und Motion-Graphics-Kenntnisse bekam. In einem Filmstudio habe ich mit Filmemachern Motion Graphics und Illustrationen gemacht und Geometrie, Ordnung und Proportion aus der Architektur eingebracht.') },
    ],
  },
  {
    place: 'stuttgart', city: t('STUTTGART'), from: 2017.5, cards: [
      { bar: 14, kind: 'other', logo: 'agi',
        title: t('B2 degree in German language', 'B2-Zertifikat Deutsch'),
        sub: t('agi Stuttgart (2017 - 2019)'),
        more: t('German at agi in Stuttgart, up to B2.',
                'Deutsch bei agi in Stuttgart, bis B2.') },
      { bar: 3, kind: 'work', logo: 'werner-sobek',
        title: t('Architectural designer', 'Architekt Entwurf'),
        sub: t('Werner Sobek (2018-2021)'),
        more: t('Three years at Werner Sobek, one of Germany’s leading offices for architecture and engineering. Alongside civil engineers I designed buildings, structures and pavilions, across architecture, experience design and 3D, such as the Inner Loop shading at EXPO 2020 Dubai. I learned a lot about structure and sustainable building, and worked with colleagues in the office’s branches abroad on projects in many countries.',
                'Drei Jahre bei Werner Sobek, einem der führenden Büros für Architektur und Ingenieurwesen in Deutschland. Gemeinsam mit Bauingenieuren habe ich Gebäude, Tragwerke und Pavillons entworfen, über Architektur, Experience Design und 3D hinweg, etwa die Verschattung des Inner Loop auf der EXPO 2020 Dubai. Ich habe viel über Tragwerke und nachhaltiges Bauen gelernt und mit Kollegen in den Niederlassungen des Büros an Projekten in vielen Ländern gearbeitet.') },
    ],
  },
  {
    place: 'berlin', city: t('BERLIN'), from: 2021.5, cards: [
      { bar: 4, kind: 'work', logo: 'artcom',
        title: t('Designer'),
        sub: t('ART+COM (2021-2022)'),
        more: t('Interiors and exhibitions at ART+COM: with programmers and designers I shaped spaces that tell their story through media, such as the BMW Visitors Center in Regensburg.',
                'Innenräume und Ausstellungen bei ART+COM: Mit Programmierern und Designern habe ich Räume gestaltet, die ihre Geschichte mit Medien erzählen, etwa das BMW Besucherzentrum in Regensburg.') },
      { bar: 15, kind: 'other', logo: 'architektenkammer',
        title: t('Official chamber registration', 'Eintragung Architektenkammer'),
        sub: t('Architektenkammer berlin 2024', 'Architektenkammer Berlin 2024'),
        more: t('Registered with the Berlin Chamber of Architects since 2024, which lets me work under the protected title of architect in Germany.',
                'Seit 2024 bei der Architektenkammer Berlin eingetragen und damit berechtigt, in Deutschland die geschützte Berufsbezeichnung Architekt zu führen.') },
      { bar: 5, kind: 'work', logo: 'leonard-design',
        title: t('Architect - 3D artist', 'Architekt - 3D-Artist'),
        sub: t('Leonard Design Architects (2022-2025)'),
        more: t('Three years at Leonard Design Architects on retail and mixed-use projects: shopping centres, retail spaces, an airport, student dormitories and housing, from competitions to execution. Mostly for the UK market, with international and German projects, and an interior I realised here in Berlin.',
                'Drei Jahre bei Leonard Design Architects an Handels- und Mischnutzungsprojekten: Einkaufszentren, Ladenflächen, ein Flughafen, Studentenwohnheime und Wohnungsbau, vom Wettbewerb bis zur Ausführung. Vor allem für den britischen Markt, dazu internationale und deutsche Projekte und ein Innenraum, den ich hier in Berlin realisiert habe.') },
      { bar: 8, kind: 'work', logo: 'resvr',
        title: t('Designer - co founder', 'Designer - Mitgründer'),
        // just the title and the time (Emil 23 Oct: no explanation)
        sub: t('ResVR (2023 - )') },
      { bar: 6, kind: 'work', logo: 'es',
        title: t('Freelancer', 'Freiberuflich'),
        sub: t('Architect - designer (2025 - )', 'Architekt - Designer (2025 - )') },
    ],
  },
];

/** the axis ends here (ongoing work runs to it with an arrow) */
const END_YEAR = 2026;

/** bars in years; 2008 = the start of the Syria cards (they began before the axis) */
const BAR_YEARS: { col: number; from: number; to: number; kind: TlBar['kind']; cap?: TlBar['cap'] }[] = [
  // column 18: main work line (green, one gradient running down the whole timeline)
  { col: 18, from: 2008, to: 2013.25, kind: 'work', cap: 'up' },   // 0 Tarek Jeffe
  { col: 18, from: 2013.5, to: 2015.5, kind: 'work' },              // 1 Russia: Antonio & Partners, Ecostroy
  { col: 18, from: 2016.75, to: 2018.5, kind: 'work' },             // 2 Northwind Visuals
  { col: 18, from: 2018.75, to: 2021.25, kind: 'work' },            // 3 Werner Sobek
  { col: 18, from: 2021.5, to: 2022.5, kind: 'work' },              // 4 ART+COM
  { col: 18, from: 2022.75, to: 2025.25, kind: 'work' },            // 5 Leonard Design Architects
  { col: 18, from: 2025.5, to: END_YEAR, kind: 'work', cap: 'down' },// 6 Freelance (ongoing)
  // column 16: parallel work
  { col: 16, from: 2014.75, to: 2015.5, kind: 'work' },             // 7 Ecostroy
  { col: 16, from: 2023.5, to: END_YEAR, kind: 'work', cap: 'down' },// 8 ResVR (ongoing)
  // column 20: education (grey) and languages / internships / registration (framed)
  { col: 20, from: 2008, to: 2012.75, kind: 'edu', cap: 'up' },     // 9 Bachelor, Tishreen University
  { col: 20, from: 2013.5, to: 2014.5, kind: 'other' },             // 10 C1 Russian
  { col: 20, from: 2014.75, to: 2015.75, kind: 'edu' },             // 11 Architectural design course
  { col: 20, from: 2016, to: 2016.25, kind: 'other' },              // 12 Design apprentice
  { col: 20, from: 2016.5, to: 2016.75, kind: 'other' },            // 13 Architectural intern
  { col: 20, from: 2017.5, to: 2019.5, kind: 'other' },             // 14 B2 German
  { col: 20, from: 2022.5, to: 2023.75, kind: 'other' },            // 15 Chamber registration
];

/* ---------------------------------------------------------------- layout */

const CARD_ROWS = 4;
const CARD_PITCH = CARD_ROWS + 1;           // one empty cell between cards
const AXIS_TOP = 2;                          // 1989 / the Syria line
/** every year the same height on the axis */
export const ROWS_PER_YEAR = 7;
/** a place's line is this many rows under the previous place's last card (unless its year is lower) */
const PLACE_GAP = 2;

const headings: TlHeading[] = [];
const cards: TlCard[] = [];
const connectors: TlConnector[] = [];
const eraTops: { place: Place; top: number }[] = [];
const stops: number[] = [0];
const timeStops: number[] = [0];

// Syria comes first: 1989 on top, its cards from 2008, then the even years from 2013
const syria = ERAS[0];
const syriaFirst = AXIS_TOP + 1;
const YEAR0_ROW = syriaFirst + syria.cards.length * CARD_PITCH;   // 2013, just under the Syria cards
/** row of a year on the axis */
function rowOf(year: number): number {
  if (year >= 2013) return YEAR0_ROW + (year - 2013) * ROWS_PER_YEAR;
  if (year >= 2008) return syriaFirst + (YEAR0_ROW - syriaFirst) * (year - 2008) / 5;
  return AXIS_TOP + (syriaFirst - AXIS_TOP) * Math.max(0, year - 1989) / 19;
}
const onGrid = (year: number) => Math.round(rowOf(year));

/* The end of Syria, drawn as one figure: the degree's bar ends at 2013, one empty cell, the
   graduation cap, the first job's bar ending level with the cap's bottom, one empty cell,
   then Russia's line. */
const DEGREE_END = onGrid(2012.75);          // bar 9, Bachelor
const GRAD_ROW = DEGREE_END + 1;             // the cap, one cell tall
const SYRIA_WORK_END = GRAD_ROW + 1;         // bar 0, Tarek Jeffe
const RUSSIA_ROW = SYRIA_WORK_END + 1;
const BAR_END: Record<number, number> = { 9: DEGREE_END, 0: SYRIA_WORK_END };

/** each bar's rows (whole cells) */
const barRows = BAR_YEARS.map((b, i) => {
  const y0 = onGrid(b.from);
  return { y0, y1: BAR_END[i] ?? Math.max(y0 + 1, onGrid(b.to)) };
});

/** row where each place begins on the axis */
const startRows = ERAS.map((era, i) => i === 0 ? AXIS_TOP : i === 1 ? RUSSIA_ROW : onGrid(era.from));

/** the last place of each country: its heading and line stay lit through all its cities */
const countryEnd = ERAS.map((era, i) => {
  let j = i;
  while (era.country && j + 1 < ERAS.length && !ERAS[j + 1].country) j++;
  return ERAS[j].place;
});

let end = 0;                                 // where the previous place ends (its stop)
let lastCard = 0;                            // bottom row of the previous place's last card
ERAS.forEach((era, i) => {
  const timeRow = startRows[i];
  // rows from a place's line to the bottom of its last card
  const span = (era.city ? 2 : 1) + era.cards.length * CARD_PITCH - 1;
  let top = i === 0 ? AXIS_TOP : Math.max(timeRow, lastCard + PLACE_GAP);
  // the last place ends with the axis: its last card's bottom on today's year (it is a city
  // without a line of its own, so sitting a little below its year shows no bend)
  if (i === ERAS.length - 1) top = Math.max(top, onGrid(END_YEAR) - span);
  eraTops.push({ place: era.place, top });
  if (era.country) {
    const until = countryEnd[i];
    headings.push({ y: top - 1, at: top + 0.5, place: era.place, until, label: era.country });   // text sits on its line
    let segments: TlSegment[];
    if (i === 0) segments = [{ x0: 0, y0: top, x1: 21.6, y1: top }];                    // to the 1989 marker
    else if (timeRow === top) segments = [{ x0: 0, y0: top, x1: 22, y1: top }];
    else segments = [                                                                    // bends up to its year
      { x0: 0, y0: top, x1: 15, y1: top }, { x0: 15, y0: top, x1: 15, y1: timeRow }, { x0: 15, y0: timeRow, x1: 22, y1: timeRow }];
    connectors.push({ at: top + 0.5, node: i === 0 ? undefined : timeRow, place: era.place, until, segments });
  }
  if (era.city) headings.push({ y: top + 0.5, at: top + 1, place: era.place, until: era.place, city: true, label: era.city });
  const first = era.city ? top + 2 : top + 1;
  era.cards.forEach((c, k) => cards.push({ ...c, place: era.place, y: first + k * CARD_PITCH }));
  const cardsEnd = first + era.cards.length * CARD_PITCH;           // one cell under the last card
  lastCard = cardsEnd - 1;
  const next = i + 1 < ERAS.length ? startRows[i + 1] : rowOf(END_YEAR);
  end = Math.ceil(Math.max(cardsEnd, next));
  stops.push(end);
  // the time line is drawn to the next place's year — and on to the end of every bar of the
  // cards shown so far, so a card never appears without its whole time
  const cardTime = Math.max(...era.cards.map(c => barRows[c.bar].y1));
  timeStops.push(i + 1 < ERAS.length ? Math.max(next, cardTime) : end);
});
const AXIS_END = end;

/** rows of the panel as drawn */
export const ROWS = AXIS_END + 1;
export const HEADINGS = headings;
export const CARDS = cards;
export const CONNECTORS = connectors;
export const BARS: TlBar[] = BAR_YEARS.map((b, i) => ({ col: b.col, ...barRows[i], kind: b.kind, cap: b.cap }));
/** graduation marker in column 20, under the degree (see the end of Syria) */
export const GRADUATION = { col: 20, y: GRAD_ROW };
export const AXIS = { x: 22, y0: AXIS_TOP, y1: AXIS_END };
export const YEARS: { y: number; label: string }[] = [
  { y: AXIS_TOP, label: '1989' },
  ...Array.from({ length: END_YEAR - 2013 + 1 }, (_, i) => ({ y: onGrid(2013 + i), label: String(2013 + i) })),
];

/** the places in the order they are told */
export const PLACES: Place[] = ERAS.map(e => e.place);

/**
 * Where the story pauses: blank, then after each place — at the end of its cards and of its
 * time, whichever is later (the last one is the end of the axis).
 */
export const STORY_STOPS: number[] = stops;
/** ...and how far the time line (axis, years, bars) is drawn there: to the end of the place's
    time, not further — the next place's years are not shown before it is told */
export const TIME_STOPS: number[] = timeStops;

/** the place being told at a reading line (rows) */
export function placeAt(line: number): Place {
  let p: Place = eraTops[0].place;
  for (const e of eraTops) if (line > e.top) p = e.place;
  return p;
}
