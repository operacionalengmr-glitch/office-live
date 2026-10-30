// Team roster. `id` is the game_id the timesheet maps each account to (Supabase table office_characters).
// `desk` must match a desk id in world.js; `screens` picks what their two monitors show.
// `status` is only the demo state used when nobody is signed in.
export const TEAM = [
  { id: 'jaiane', name: 'Jaiane Araújo', short: 'Jaiane', role: 'Engineer', dept: 'Engineering',
    quote: 'Small steps also move big goals.', desk: 'r1b', status: 'working', screens: ['sheet', 'chart'], color: '#f0a3c4' },
  { id: 'letticia', name: 'Letticia', short: 'Letticia', role: 'Designer', dept: 'Design',
    quote: 'Less talk, more results.', desk: 'r1c', status: 'working', screens: ['kanban', 'sheet'], color: '#c9a2ff' },
  { id: 'paulo', name: 'Paulo', short: 'Paulo', role: 'Designer', dept: 'Design',
    quote: '', desk: 'mta', status: 'working', screens: ['grasshopper', 'rhino'], color: '#9fd8ff' },
  { id: 'jose', name: 'José Igor', short: 'José Igor', role: 'Designer', dept: 'Design',
    quote: 'Better code, better tomorrow.', desk: 'mtb', status: 'working', screens: ['code', 'code'], color: '#7fe0b0' },
  { id: 'math', name: 'Matheus', short: 'Matheus', role: 'Engineer', dept: 'Engineering',
    quote: 'In God we trust; all others must bring data.', desk: 'mtc', status: 'working', screens: ['chart', 'code'], color: '#ffd27a' },
  { id: 'raffael', name: 'Raffael', short: 'Raffael', role: 'Engineer', dept: 'Engineering',
    quote: 'Just doing my best one day at a time.', desk: 'mba', status: 'working', screens: ['grasshopper', 'rhino'], color: '#8ab4ff' },
  { id: 'alex', name: 'Alex', short: 'Alex', role: 'Designer', dept: 'Design',
    quote: '', desk: 'mbb', status: 'working', screens: ['cad', 'rhino'], color: '#e8c79a' },
  { id: 'guilherme', name: 'Guilherme Rocha', short: 'Guilherme', role: 'Designer', dept: 'Design',
    quote: 'Work hard, play harder.', desk: 'mbc', status: 'break', screens: ['code', 'rhino'], color: '#ff9f80' },
  { id: 'nathan', name: 'Nathan Frederico', short: 'Nathan', role: 'Engineer', dept: 'Engineering',
    quote: 'Just doing my best one day at a time.', desk: 'r3b', status: 'working', screens: ['sheet', 'cad'], color: '#a0e7e5' },
];

export const STATUS = {
  working: { label: 'Trabalhando', color: '#4fd18b' },
  break: { label: 'Pausa', color: '#f2c14e' },
  offline: { label: 'Fora', color: '#6b7489' },
};
