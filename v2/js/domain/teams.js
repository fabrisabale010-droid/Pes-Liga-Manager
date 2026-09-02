/* Una selección: id = código FIFA, iso = código para las banderas SVG,
   colors = paleta real de la bandera, crest = escudo oficial cuando lo tengas.
   Para sumar una selección nueva alcanza con agregar una línea acá. */

export const CORE = [
  { id:'BRA', name:'Brasil',        iso:'br',     colors:['#009c3b','#ffdf00','#002776'], crest:null },
  { id:'ARG', name:'Argentina',     iso:'ar',     colors:['#75aadb','#ffffff','#f6b40e'], crest:null },
  { id:'FRA', name:'Francia',       iso:'fr',     colors:['#0055a4','#ffffff','#ef4135'], crest:null },
  { id:'ITA', name:'Italia',        iso:'it',     colors:['#008c45','#f4f5f0','#cd212a'], crest:null },
  { id:'ENG', name:'Inglaterra',    iso:'gb-eng', colors:['#ffffff','#cf142b'],           crest:null },
  { id:'ESP', name:'España',        iso:'es',     colors:['#aa151b','#f1bf00'],           crest:null },
  { id:'GER', name:'Alemania',      iso:'de',     colors:['#000000','#dd0000','#ffce00'], crest:null },
  { id:'POR', name:'Portugal',      iso:'pt',     colors:['#046a38','#da291c','#ffe900'], crest:null },
  { id:'NED', name:'Holanda',       iso:'nl',     colors:['#ae1c28','#ffffff','#21468b'], crest:null },
  { id:'URU', name:'Uruguay',       iso:'uy',     colors:['#75aadb','#ffffff','#fcd116'], crest:null },
];

export const EXTRA = [
  { id:'MEX', name:'México',        iso:'mx', colors:['#006341','#ffffff','#ce1126'], crest:null },
  { id:'COL', name:'Colombia',      iso:'co', colors:['#fcd116','#003893','#ce1126'], crest:null },
  { id:'CHI', name:'Chile',         iso:'cl', colors:['#d52b1e','#ffffff','#0033a0'], crest:null },
  { id:'PAR', name:'Paraguay',      iso:'py', colors:['#d52b1e','#ffffff','#0038a8'], crest:null },
  { id:'ECU', name:'Ecuador',       iso:'ec', colors:['#ffd100','#034ea2','#ed1c24'], crest:null },
  { id:'PER', name:'Perú',          iso:'pe', colors:['#d91023','#ffffff'],           crest:null },
  { id:'USA', name:'Estados Unidos',iso:'us', colors:['#b22234','#ffffff','#3c3b6e'], crest:null },
  { id:'CRO', name:'Croacia',       iso:'hr', colors:['#ff0000','#ffffff','#171796'], crest:null },
  { id:'BEL', name:'Bélgica',       iso:'be', colors:['#000000','#fdda24','#ef3340'], crest:null },
  { id:'DEN', name:'Dinamarca',     iso:'dk', colors:['#c60c30','#ffffff'],           crest:null },
  { id:'SWE', name:'Suecia',        iso:'se', colors:['#006aa7','#fecc02'],           crest:null },
  { id:'POL', name:'Polonia',       iso:'pl', colors:['#ffffff','#dc143c'],           crest:null },
  { id:'RUS', name:'Rusia',         iso:'ru', colors:['#ffffff','#0039a6','#d52b1e'], crest:null },
  { id:'SRB', name:'Serbia',        iso:'rs', colors:['#c6363c','#0c4076','#ffffff'], crest:null },
  { id:'SUI', name:'Suiza',         iso:'ch', colors:['#d52b1e','#ffffff'],           crest:null },
  { id:'AUT', name:'Austria',       iso:'at', colors:['#ed2939','#ffffff'],           crest:null },
  { id:'TUR', name:'Turquía',       iso:'tr', colors:['#e30a17','#ffffff'],           crest:null },
  { id:'JPN', name:'Japón',         iso:'jp', colors:['#ffffff','#bc002d'],           crest:null },
  { id:'KOR', name:'Corea del Sur', iso:'kr', colors:['#ffffff','#c60c30','#003478'], crest:null },
  { id:'MAR', name:'Marruecos',     iso:'ma', colors:['#c1272d','#006233'],           crest:null },
];

export const TEAMS = [...CORE, ...EXTRA];

const byId = new Map(TEAMS.map(t => [t.id, t]));

export const team   = id => byId.get(id) || null;
export const nameOf = id => byId.get(id)?.name ?? id;
export const colorsOf = id => byId.get(id)?.colors ?? ['#4d8dff','#9dc2ff'];
export const mainColorOf = id => colorsOf(id)[0];
