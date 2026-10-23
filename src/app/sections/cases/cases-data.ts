import type { MenuTone } from '../../_services/backdrop.service';
/* ------------------------------------------------------------------------------------
   The cases, one per slide of the cases page — laid out exactly like the pitch deck.

   A case with a video shows that video as the whole slide (16:9, the deck's slide
   exported as an animation, the space for the text left white) with the web text on
   top of it, in the deck's places and type (see cases.scss). A case without a video
   shows just its text for now.

   - video: an .mp4 (muted, looping), 1920 × 1080 like the deck's slides; the deck's own
     progress line along the bottom is cropped off and the site draws its own there (hover
     it to stop the video and scrub). Encoded with a keyframe every 2 s so scrubbing is smooth
   - text: a translation key (`CASES.…`, en/de in assets/i18n) or plain { en, de } text;
     a blank line starts a new paragraph
   - textWidth: the width of the text in the deck (slide px, of 1920), where it differs
   ------------------------------------------------------------------------------------ */

export type CaseTag = 'architecture' | 'visualisation' | 'experience' | 'branding' | 'video';

/** the category tabs, in order */
export const CASE_TAGS: { tag: CaseTag; en: string; de: string }[] = [
  { tag: 'architecture', en: 'architecture', de: 'architektur' },
  { tag: 'visualisation', en: 'visualisation', de: 'visualisierung' },
  { tag: 'experience', en: 'experience design', de: 'experience design' },
  { tag: 'branding', en: 'branding', de: 'branding' },
  { tag: 'video', en: 'video', de: 'video' },
];

export interface Txt { en: string; de: string; }

/** a render shown instead of the deck's video (desktop: in the frame, the text over it) */
export interface CaseStill {
  src: string;
  /** where the picture starts, in slide px from the frame's left (it runs to the frame's right
      end, as tall as the frame, cropped to fit: `pos` is which part stays) */
  left?: number;
  pos?: string;
  /** the picture's width / height: given, it is never shown larger than the frame's height —
      on wider frames it moves right instead (the wash with it) */
  ratio?: number;
  /** or the whole picture, as tall as the frame, against the frame's right end (nothing cut:
      the picture carries its own extension fading out to the left) */
  whole?: boolean;
  /** the white wash from the top-left corner: [angle (deg, CSS), white up to, gone by] — the
      last two in slide px along the angle, easing out between (measured off Emil's mockups) */
  wash?: [number, number, number];
  /** or white boxes behind the text: [white up to x, gone by x, white down to y, gone by y],
      slide px each */
  box?: [number, number, number, number][];
}

export interface CaseItem {
  id: string;
  title: string | Txt;
  year?: string;
  location?: string | Txt;
  role?: Txt;
  /** the office the project was made with (Emil 23 Oct): "Project: ..." under the role */
  project?: Txt;
  /** a translation key (CASES.CASE-n.DESCRIPTION) or plain text (three sentences: Emil 23 Oct) */
  text: string | Txt;
  tags: CaseTag[];
  /** the slide's video (mp4) */
  video?: string;
  /** or a still: a render in the frame, washed out to white behind the text */
  image?: CaseStill;
  /** width of the text block in slide px (the deck's is 902 of 1920) */
  textWidth?: number;
  /** where the text must end, in slide px from the top: above the slide's pictures (a deck
      video: 520 unless set; measured off the videos' frames, Emil 21 Oct) */
  textBottom?: number;
  /** the video not as the deck's slide but a film: as tall as the frame, against its right
      end, faded in from white across [from, to] slide px from its left edge (where it would
      start against the right end). shift: slide px the film moves right under the fade, its
      right end cropped, so its middle comes further into view (Emil 22 Oct: 8, 13, 14) */
  film?: { fade: [number, number]; shift?: number };
  /** the video's first picture, shown while it loads */
  poster?: string;
  /** the video framed in this place on the slide (desktop; slide px: x, y, w, h) instead of
      filling it (it is not the deck's slide: nothing cropped, no fade) */
  place?: [number, number, number, number];
  /** the film on YouTube: a "watch video on youtube" button under the frame */
  youtube?: string;
  /** the side menu over this case: white (some kept black), else black */
  menu?: MenuTone;
  /** left out for now (kept here to bring back) */
  hidden?: boolean;
  /** a mark shown after the title (the project's logo): a picture, or an .mp4 that loops */
  logo?: string;
  /** drawings / animations placed on the slide (desktop), in slide px */
  pieces?: CasePiece[];
  /** phones only: the pictures in the square, one after the other, instead of the desktop's
      (Emil 23 Oct: ResVR's new elements are for the phone; the desktop keeps its slide).
      pan: a picture this much wider than tall fills the square and pans slowly left to right */
  phoneMedia?: { src: string; video?: boolean; poster?: string; pan?: number }[];
}

export interface CasePiece {
  src: string;
  /** a looping, muted video (plays while the page is in view) */
  video?: boolean;
  /** its first picture, shown while it loads */
  poster?: string;
  x: number; y: number; w: number; h: number;
  /** a thin line around it */
  framed?: boolean;
}

const t = (en: string, de: string = en): Txt => ({ en, de });
const V = 'assets/projects/cases/';
const R = 'assets/projects/resvr/';
const B = 'assets/projects/bmw/';
const L = 'assets/projects/inner-loop/';
const W = 'assets/projects/wolkenreich/';
const H = 'assets/projects/bw-haus/';
const U = 'assets/projects/usq/';
const A = 'assets/projects/artcom/';

export const ALL_CASES: CaseItem[] = [
  // ---- with the deck's slide as a video, in the deck's order ----
  {
    id: 'bmw', title: t('BMW visitor center', 'BMW Besucherzentrum'), year: '2021',
    location: t('Regensburg - Germany', 'Regensburg - Deutschland'),
    role: t('Designed the concept and the space, and made the execution plans.',
            'Konzept und Raum entworfen und die Ausführungsplanung erstellt.'),
    project: t('ART+COM',
            'ART+COM'),
    text: t('A visitor center for the BMW Group in Regensburg. Employees explore the plant\'s production lines. They see how their work shapes the final car.',
            'Ein Besucherzentrum der BMW Group in Regensburg. Mitarbeitende erkunden die Produktion des Werks. Sie sehen, wie ihre Arbeit das Auto prägt.'),
    tags: ['architecture', 'experience'],
    // phones (Emil 23 Oct): the entrance hall, the blue room, the film, the plan
    phoneMedia: [
      { src: B + 'bmw-hall.webp', pan: 1536 / 1024 },
      { src: B + 'bmw-room.webp', pan: 1536 / 1024 },
      { src: B + 'bmw-film.mp4', video: true, poster: B + 'bmw-film-poster.webp' },
      { src: B + 'bmw-plan.webp' },
    ],
    video: V + 'bmw.mp4', textWidth: 860, textBottom: 520,
  },
  {
    id: 'inner-loop', title: 'Inner Loop', year: '2019', location: t('Dubai - UAE', 'Dubai - VAE'),
    role: t('I designed the birds, optimized their layout with a Grasshopper script, and oversaw the execution plans.',
            'Ich habe die Vögel entworfen, ihre Anordnung mit einem Grasshopper-Skript optimiert und die Ausführungsplanung betreut.'),
    project: t('Werner Sobek',
            'Werner Sobek'),
    text: t('EXPO 2020 Dubai\'s main walkway, shaded by 3,370 birds. Their shadows shift all day. We developed and built SWA\'s idea.',
            'Der Hauptweg der EXPO 2020 Dubai, beschattet von 3.370 Vögeln. Ihre Schatten wandern den Tag über. Wir bauten SWAs Idee.'),
    tags: ['architecture', 'visualisation', 'experience'],
    // phones (Emil 23 Oct): his photos (filling the square, panning), the birds' evolution,
    // then the plan with the orange
    phoneMedia: [
      { src: L + 'il-night.webp', pan: 1650 / 1100 },
      { src: L + 'il-shadows.webp', pan: 1650 / 1100 },
      { src: L + 'il-day.webp', pan: 1070 / 792 },
      { src: L + 'il-birds.webp', pan: 1024 / 683 },
      { src: L + 'il-sunset.webp', pan: 1024 / 683 },
      { src: L + 'il-above.webp', pan: 1221 / 811 },
      { src: L + 'il-sky.webp', pan: 1403 / 883 },
      { src: L + 'il-aerial.webp', pan: 1408 / 874 },
      { src: L + 'il-evolution.webp' },
      { src: L + 'il-plan.webp' },
    ],
    video: V + 'inner-loop.mp4', textWidth: 860, textBottom: 520,
  },
  {
    id: 'wolkenreich', title: 'Wolkenreich', year: '2020', location: t('Heilbronn - Germany', 'Heilbronn - Deutschland'),
    role: t('Designed the interactive scenarios and created the visual content.',
            'Interaktive Szenarien entworfen und die visuellen Inhalte erstellt.'),
    project: t('Werner Sobek, University of Stuttgart',
            'Werner Sobek, Universität Stuttgart'),
    text: t('An interactive ceiling of 85 paper umbrellas for Experimenta Heilbronn. Sensors track visitors, and it moves with them. A tablet plays choreographies or games.',
            'Eine interaktive Decke aus 85 Papierschirmen für die Experimenta Heilbronn. Sie bewegt sich mit den Besuchern. Ein Tablet spielt Choreografien oder Spiele.'),
    tags: ['experience'],
    // phones (Emil 23 Oct, folder 3): the ceiling moving, an umbrella, the mounting sketch,
    // then the plan of the visitors' activity
    phoneMedia: [
      { src: W + 'wr-film.mp4', video: true, poster: W + 'wr-film-poster.webp' },
      { src: W + 'wr-umbrella.webp', pan: 1196 / 1039 },
      { src: W + 'wr-sketch.webp' },
      { src: W + 'wr-plan.mp4', video: true, poster: W + 'wr-plan-poster.webp' },
    ],
    video: V + 'wolkenreich.mp4', textWidth: 860, textBottom: 528,
  },
  {
    id: 'bw-haus', title: 'BW Haus', year: '2019', location: t('Dubai - UAE', 'Dubai - VAE'),
    role: t('Co-design, lead 3D modeling and visualizations.',
            'Co-Design, Leitung der 3D-Modellierung und Visualisierungen.'),
    project: t('Werner Sobek',
            'Werner Sobek'),
    text: t('Our competition entry for Baden-Württemberg\'s pavilion at EXPO 2020 Dubai. Timber honeycomb walls carry the roof, plants and exhibits. It won third place.',
            'Unser Wettbewerbsbeitrag für den Pavillon Baden-Württembergs auf der EXPO 2020 Dubai. Holzwaben tragen Dach, Pflanzen und Exponate. Er wurde Dritter.'),
    tags: ['architecture', 'visualisation'],
    // phones (Emil 23 Oct, folder 4): the pavilion, its parts, the honeycomb walls, the plans
    phoneMedia: [
      { src: H + 'bw-1.webp' },
      { src: H + 'bw-2.webp' },
      { src: H + 'bw-3.webp' },
      { src: H + 'bw-4.webp' },
    ],
    video: V + 'bw-haus.mp4', textWidth: 860, textBottom: 522,
  },
  {
    id: 'usq', title: t('USQ Glass Roof', 'USQ Glasdach'), year: '2015 - 2022', location: t('Hamburg - Germany', 'Hamburg - Deutschland'),
    role: t('I supported the design team with drawings, visualizations and 3D modeling.',
            'Zeichnungen, Visualisierungen und 3D-Modelle für das Entwurfsteam.'),
    project: t('Werner Sobek',
            'Werner Sobek'),
    text: t('Hamburg\'s first glass roof over a main street. A fine steel grid shell grows from cup-shaped columns. Its panels were optimized in Grasshopper.',
            'Hamburgs erstes Glasdach über einer Hauptstraße. Eine Stahlgitterschale wächst aus kelchförmigen Stützen. Die Paneele sind parametrisch optimiert.'),
    tags: ['architecture', 'visualisation'],
    // phones (Emil 23 Oct, folder 5): the two street views, then the plan
    phoneMedia: [
      { src: U + 'usq-1.webp', pan: 1024 / 576 },
      { src: U + 'usq-2.webp', pan: 1024 / 576 },
      { src: U + 'usq-plan.mp4', video: true, poster: U + 'usq-plan-poster.webp' },
    ],
    video: V + 'usq.mp4', textWidth: 900, textBottom: 528,
    youtube: 'https://www.youtube.com/watch?v=4xI0fWoaHu8',
  },
  {
    id: 'artcom-office', title: t('Art+Com Office Space', 'Art+Com Büro'), year: '2021', location: t('Berlin - Germany', 'Berlin - Deutschland'),
    role: t('Interior design and visualization.', 'Innenarchitektur und Visualisierung.'),
    project: t('ART+COM',
            'ART+COM'),
    text: t('ART+COM\'s new three-floor campus at Oranienplatz, for around 150 people. Concrete, wood and glass, zoned by furniture rather than walls. The long desks turn into seating steps, making the office an event space in minutes.',
            'Der neue Campus von ART+COM am Oranienplatz, auf drei Etagen für rund 150 Menschen. Beton, Holz und Glas, gegliedert durch Möbel. Die Tische werden zu Sitzstufen, das Büro zum Veranstaltungsraum.'),
    tags: ['architecture', 'visualisation'],
    // phones (Emil 23 Oct, folder 6): the floors' renders in his order, then the plan
    phoneMedia: [
      { src: A + 'ac-1-1.webp', pan: 1536 / 864 },
      { src: A + 'ac-1-2.webp', pan: 1536 / 864 },
      { src: A + 'ac-2-1.webp', pan: 1536 / 864 },
      { src: A + 'ac-2-2.webp', pan: 1536 / 864 },
      { src: A + 'ac-2-3.webp', pan: 1536 / 864 },
      { src: A + 'ac-3-1.webp', pan: 1536 / 864 },
      { src: A + 'ac-plan.mp4', video: true, poster: A + 'ac-plan-poster.webp' },
    ],
    video: V + 'artcom-office.mp4', textWidth: 800, textBottom: 526,
  },
  {
    id: 'resvr', title: 'ResVR', year: '2022 - 2026', location: t('Alberta - Canada', 'Alberta - Kanada'),
    role: t('Architect and designer: 3D interiors, interface and brand.',
            'Architekt und Designer: 3D-Innenräume, Oberfläche und Marke.'),
    text: t('A virtual showhome platform: buyers walk through a house before it exists. I owned the whole visual side: 3D interiors, interface and brand. My first spaces made only for the screen.',
            'Eine virtuelle Musterhaus-Plattform: Käufer gehen durch ein Haus, bevor es existiert. Ich habe die ganze visuelle Seite verantwortet. Meine ersten Räume nur für den Bildschirm.'),
    tags: ['visualisation', 'experience', 'branding'],
    // the desktop: its deck slide as it was (Emil 23 Oct)
    video: V + 'resvr.mp4', textWidth: 540, textBottom: 600,
    // phones: Emil's elements (22 Oct), one after the other in the square
    phoneMedia: [
      { src: R + 'resvr-demo.mp4', video: true, poster: R + 'resvr-demo-poster.webp' },
      { src: R + 'resvr-web.mp4', video: true, poster: R + 'resvr-web-poster.webp' },
      { src: R + 'resvr-globe.mp4', video: true, poster: R + 'resvr-globe-poster.webp' },
      { src: R + 'resvr-software.mp4', video: true, poster: R + 'resvr-software-poster.webp' },
      { src: R + 'resvr-ui.webp' },
    ],
  },

  // ---- no video yet: just the text ----
  {
    id: 'waha', title: 'Waha', year: '2018', location: t('Homs - Syria', 'Homs - Syrien'),
    role: t('Concept, design and film.',
            'Konzept, Entwurf und Film.'),
    text: t('Waha, Arabic for "oasis", is a rest stop near Palmyra in the Syrian desert. Its domes come from the region\'s beehive houses, cooled by water and greenery. It imagines how tourism could help Syria recover after the war.',
            'Waha, arabisch für „Oase“, ist ein Rastplatz nahe Palmyra. Die Kuppeln stammen von den Bienenkorbhäusern der Region, Wasser und Grün kühlen sie. Das Projekt fragt, wie Tourismus Syrien nach dem Krieg helfen kann.'),
    tags: ['architecture', 'visualisation', 'experience'],
    menu: { white: true },
    video: 'assets/projects/waha/waha.mp4', poster: 'assets/projects/waha/waha-poster.webp', film: { fade: [208, 848], shift: 180 },
    // TODO: the film's own YouTube link (a search for it until then)
    youtube: 'https://www.youtube.com/results?search_query=Waha+Emil+Suliman',
    logo: 'assets/projects/waha/waha-logo.webp',
    pieces: [
      // the plan, its spaces and views lighting up (the circle as in the mockup)
      { src: 'assets/projects/waha/waha-plan.mp4', video: true, x: 18, y: 484, w: 596, h: 596 },   // ends on the frame's bottom (it ran 16 px past)
    ],
  },
  {
    id: 'isenburg', title: 'Isenburg Zentrum', year: '2023', location: t('Isenburg - Germany', 'Isenburg - Deutschland'),
    role: t('Facade design and visualisation.',
            'Fassadengestaltung und Visualisierung.'),
    project: t('Leonard Design Architects',
            'Leonard Design Architects'),
    text: t('A declining mall in Isenburg becomes a mixed-use centre of retail, hotel and services. New façades and a reimagined courtyard give it a fresh identity. Active public spaces bring new life.',
            'Ein rückläufiges Einkaufszentrum in Isenburg wird zum Mix aus Handel, Hotel und Dienstleistungen. Neue Fassaden und ein neuer Hof geben ihm eine frische Identität. Ein Hotel und belebte Plätze bringen neues Leben.'), tags: ['architecture', 'visualisation'],
    // white, but the arrow and the first two words over its bright sky
    menu: { white: true, except: ['up', 'about', 'timeline'] },
    // its ratio known: on a frame wider than the picture it moves right instead of being cut
    // top and bottom (it lost up to a quarter of its height on wide windows)
    image: { src: 'assets/projects/isenburg/render.webp', ratio: 1734 / 907, pos: '50% 25%', wash: [133, 686, 1151] },
  },
  {
    id: 'swsg', title: 'SWSG Social housing', year: '2019', location: t('Stuttgart - Germany', 'Stuttgart - Deutschland'),
    role: t('Visualisation and facade design.',
            'Visualisierung und Fassadengestaltung.'),
    project: t('Werner Sobek, Aktivhaus',
            'Werner Sobek, Aktivhaus'),
    text: t('Social housing in Stuttgart, built from prefabricated wooden modules. Sustainable, high-quality homes for people with limited income. The modular system saves time, cost and carbon.',
            'Sozialer Wohnungsbau in Stuttgart aus vorgefertigten Holzmodulen. Nachhaltige, hochwertige Wohnungen für Menschen mit wenig Einkommen. Das System spart Bauzeit, Kosten und CO₂.'), tags: ['architecture', 'visualisation'],
    menu: { white: true },
    image: { src: 'assets/projects/swsg/render.webp', left: 379, ratio: 2576 / 1449, pos: '0 75%', wash: [90, 400, 870] },
  },
  {
    id: 'dormitory', title: 'Nottingham Student Dormitory', year: '2022', location: t('Nottingham - UK', 'Nottingham - UK'),
    role: t('Facade design and visualisation.',
            'Fassadengestaltung und Visualisierung.'),
    project: t('Leonard Design Architects',
            'Leonard Design Architects'),
    text: t('A student dormitory above an existing car park near Nottingham station. It makes efficient use of scarce urban land and creates a lively place to live. Its bold façade gives the area a distinctive identity.',
            'Ein Studentenwohnheim über einem Parkplatz nahe dem Bahnhof von Nottingham. Es nutzt knappe Fläche effizient und schafft ein lebendiges Zuhause. Die markante Fassade gibt dem Ort Identität.'), tags: ['architecture', 'visualisation'],
    menu: { white: true },
    image: { src: 'assets/projects/dormitory/render.webp', left: -78, ratio: 1793 / 877, pos: '100% 50%', wash: [90, 370, 640] },
  },
  {
    id: 'seafront', title: 'Poole Thistle Seafront', year: '2024', location: t('Poole - UK', 'Poole - UK'),
    role: t('Visualisation.',
            'Visualisierung.'),
    project: t('Leonard Design Architects',
            'Leonard Design Architects'),
    text: t('The redesign of a hotel, a residential complex and a tower on Poole\'s seafront. Updated architecture gives the town a coherent new image. It strengthens Poole as a tourist destination.',
            'Die Neugestaltung markanter Gebäude an der Küste von Poole: ein Hotel, ein Wohnkomplex und ein Turm. Neue Architektur und eine stimmige Identität prägen das Stadtbild neu. So wird Poole als Reiseziel gestärkt.'), tags: ['architecture', 'visualisation'],
    menu: { white: true },
    image: { src: 'assets/projects/seafront/render.webp', left: 403, ratio: 2576 / 1619, pos: '0 85%', wash: [90, 410, 940] },
  },
  {
    id: 'twin', title: 'Twin House', location: t('Neuhofen - Germany', 'Neuhofen - Deutschland'),
    role: t('Design and visualisation.',
            'Entwurf und Visualisierung.'),
    project: t('pfalzarchitekt-reiter',
            'pfalzarchitekt-reiter'),
    text: t('Two identical family homes sharing one backyard on a narrow rural plot. Each is compact yet complete, over three floors with a roof terrace. Good architecture thrives even on small sites.',
            'Zwei gleiche Familienhäuser mit gemeinsamem Garten auf schmalem Grundstück. Kompakt und doch vollständig, mit drei Etagen und Dachterrasse. Gute Architektur gelingt auch auf kleinem Raum.'), tags: ['architecture', 'visualisation'],
    // the film's first minutes are dark aerials: the text kept narrower and on white
    menu: { white: true },
    video: 'assets/projects/twin/twin.mp4', poster: 'assets/projects/twin/twin-poster.webp',
    film: { fade: [290, 990], shift: 180 }, textWidth: 700,
    // TODO: the film's own YouTube link (a search for its title until then)
    youtube: 'https://www.youtube.com/results?search_query=Low-cost+Residential+Building+Neuhofen-Germany+Emil+Suliman',
  },
  {
    id: 'nordic', title: 'Nordic Huts', hidden: true,
    text: 'CASES.CASE-7.DESCRIPTION', tags: ['architecture', 'visualisation'],
  },
  {
    id: 'video-cv', title: 'Video CV', year: '2018',
    role: t('Concept, design and animation.',
            'Konzept, Gestaltung und Animation.'),
    text: t('A video CV that translates architectural thinking into motion design. Spatial composition, sequence and storytelling tell my background more vividly than a résumé. Made for job applications, it shows both my design process and my range.',
            'Ein Video-Lebenslauf, der architektonisches Denken in Motion Design übersetzt. Komposition, Abfolge und Storytelling erzählen meinen Werdegang lebendiger als Papier. Für Bewerbungen entstanden, zeigt er Prozess und Bandbreite.'), tags: ['branding', 'video'],
    // a dark film: the text kept narrower and on white
    menu: { white: true },
    video: 'assets/projects/cv/video-cv.mp4', poster: 'assets/projects/cv/video-cv-poster.webp',
    film: { fade: [290, 990], shift: 180 }, textWidth: 700,
    // TODO: the film's own YouTube link (a search for it until then)
    youtube: 'https://www.youtube.com/results?search_query=Emil+Suliman+Video+CV',
  },
];

/** the cases shown (without the ones left out for now) */
export const CASES: CaseItem[] = ALL_CASES.filter(c => !c.hidden);
