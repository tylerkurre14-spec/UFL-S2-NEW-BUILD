
/* UFL Season 2 | AFL-inspired homepage */
/* Shared Supabase database */

const SUPABASE_URL = 'https://bamahdiizeziaqkdiztz.supabase.co';

const SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_GNkVjRrVs3bEwu1QqLQR6g_PKXz4x3y';

const db = window.supabase?.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);

const state = {
  teams: [],
  games: [],
  players: [],
  stats: [],
  settings: [],
  rankings: [],
  currentWeek: 4,
  selectedWeek: 4,
  conference: 'AFC',
  stat: 'pass_yards',
  signedInUser: null
};

const $ = id => document.getElementById(id);

const safe = value =>
  String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));

const number = value => Number(value ?? 0) || 0;

const format = value =>
  number(value).toLocaleString('en-US');

const getTeam = id =>
  state.teams.find(t => t.id === id);

const getPlayer = id =>
  state.players.find(p => p.id === id);

const shortName = team =>
  team?.nickname ||
  team?.name?.split(' ').at(-1) ||
  'TBD';

/* TEAM LOGOS */

function logo(team, className = 'team-logo') {
  if (!team) {
    return `<span class="${className}">?</span>`;
  }

  const initials = safe(team.abbreviation || 'UFL');

  const color =
    /^#[0-9A-Fa-f]{6}$/.test(team.primary_color || '')
      ? team.primary_color
      : '#303c57';

  const fallback = `
    <span class="${className}"
      style="display:grid;place-items:center;
      background:${color};color:#fff;
      font-size:11px;font-weight:900">
      ${initials}
    </span>
  `;

  const path = team.logo_path || '';

  if (!/^assets\/[\w.\-/]+\.(webp|png|jpe?g)$/i.test(path)) {
    return fallback;
  }

  return `
    <img
      class="${className}"
      src="${safe(path)}"
      alt="${safe(team.name)}"
      onerror="this.outerHTML=this.dataset.fallback"
      data-fallback="${safe(fallback)}"
    >
  `;
}

/* HELPERS */

function empty(id, message) {
  const element = $(id);

  if (element) {
    element.innerHTML =
      `<p class="loading-message">${safe(message)}</p>`;
  }
}

function setting(key, fallback) {
  const entry = state.settings.find(
    item => item.setting_key === key
  );

  return entry?.setting_value ?? fallback;
}

/* STANDINGS CALCULATIONS */

function standings() {
  const records = new Map(
    state.teams.map(team => [
      team.id,
      {
        team,
        wins: 0,
        losses: 0,
        ties: 0,
        pf: 0,
        pa: 0,
        cw: 0,
        cl: 0
      }
    ])
  );

  for (const game of state.games) {
    if (
      game.status !== 'final' ||
      game.game_type !== 'regular'
    ) continue;

    if (
      game.home_score == null ||
      game.away_score == null
    ) continue;

    const home = records.get(game.home_team_id);
    const away = records.get(game.away_team_id);

    if (!home || !away) continue;

    const hs = number(game.home_score);
    const as = number(game.away_score);

    home.pf += hs;
    home.pa += as;

    away.pf += as;
    away.pa += hs;

    const sameConference =
      home.team.conference === away.team.conference;

    if (hs === as) {
      home.ties++;
      away.ties++;
    } else if (hs > as) {
      home.wins++;
      away.losses++;

      if (sameConference) {
        home.cw++;
        away.cl++;
      }
    } else {
      away.wins++;
      home.losses++;

      if (sameConference) {
        away.cw++;
        home.cl++;
      }
    }
  }

  return [...records.values()].sort((a, b) => {
    const gamesA = a.wins + a.losses + a.ties;
    const gamesB = b.wins + b.losses + b.ties;

    const pctA = gamesA
      ? (a.wins + .5 * a.ties) / gamesA
      : 0;

    const pctB = gamesB
      ? (b.wins + .5 * b.ties) / gamesB
      : 0;

    return (
      pctB - pctA ||
      b.wins - a.wins ||
      (b.pf - b.pa) - (a.pf - a.pa) ||
      a.team.name.localeCompare(b.team.name)
    );
  });
}

/* MATCHUPS */

function renderMatchups() {
  const list = $('matchupsList');
  if (!list) return;

  const games = state.games
    .filter(game => game.week === state.selectedWeek)
    .sort(
      (a, b) =>
        Number(b.is_game_of_week) -
        Number(a.is_game_of_week)
    );

  if ($('matchupWeekLabel')) {
    $('matchupWeekLabel').textContent =
      `WEEK ${state.selectedWeek}`;
  }

  if ($('matchupStatus')) {
    const allFinal =
      games.length &&
      games.every(g => g.status === 'final');

    $('matchupStatus').textContent =
      allFinal ? 'FINAL' : 'SEASON 2';
  }

  if (!games.length) {
    empty(
      'matchupsList',
      'No matchups scheduled for this week yet.'
    );
    return;
  }

  list.innerHTML = games.map(game => {
    const away = getTeam(game.away_team_id);
    const home = getTeam(game.home_team_id);

    const hasScores =
      game.away_score != null &&
      game.home_score != null;

    const score = hasScores
      ? `${safe(game.away_score)}
         <span>–</span>
         ${safe(game.home_score)}`
      : `<span style="font-size:11px;color:var(--muted)">
          ${safe(game.status.toUpperCase())}
        </span>`;

    return `
      <div class="matchup-row">
        <div class="matchup-team">
          ${logo(away, 'matchup-logo')}
          <span class="matchup-name">
            ${safe(shortName(away))}
          </span>
        </div>

        <strong class="matchup-score">
          ${score}
        </strong>

        <div class="matchup-team">
          ${logo(home, 'matchup-logo')}
          <span class="matchup-name">
            ${safe(shortName(home))}
          </span>
        </div>
      </div>
    `;
  }).join('');
}

/* PLAYER STAT LEADERS */

const STAT_OPTIONS = new Set([
  'pass_yards',
  'pass_touchdowns',
  'rush_yards',
  'rush_touchdowns',
  'receiving_yards',
  'receiving_touchdowns',
  'tackles',
  'defensive_interceptions',
  'sacks'
]);

function renderStats() {
  const list = $('statLeaders');
  if (!list) return;

  const key = STAT_OPTIONS.has(state.stat)
    ? state.stat
    : 'pass_yards';

  const sorted = [...state.stats]
    .filter(entry => getPlayer(entry.player_id))
    .sort(
      (a, b) => number(b[key]) - number(a[key])
    )
    .slice(0, 5);

  if (!sorted.length) {
    empty('statLeaders', 'No player stats entered yet.');
    return;
  }

  list.innerHTML = sorted.map((entry, index) => {
    const player = getPlayer(entry.player_id);

    const team = getTeam(
      entry.team_id || player?.team_id
    );

    return `
      <div class="leader-row">
        <span class="leader-rank">
          ${index + 1}
        </span>

        ${logo(team, 'leader-logo')}

        <span class="leader-name">
          ${safe(player.display_name || player.username)}
        </span>

        <strong class="leader-value">
          ${format(entry[key])}
        </strong>
      </div>
    `;
  }).join('');
}

/* CONFERENCE STANDINGS */

function renderStandings() {
  const list = $('standingsList');
  if (!list) return;

  const rows = standings().filter(
    r => r.team.conference === state.conference
  );

  if (!rows.length) {
    empty(
      'standingsList',
      'No teams found in this conference.'
    );
    return;
  }

  let output = '';

  rows.forEach((r, index) => {
    if (index === 0) {
      output +=
        '<h3 class="standing-heading">TOP 2</h3>';
    }

    if (index === 2) {
      output +=
        '<h3 class="standing-heading">WILDCARD</h3>';
    }

    if (index === 3) {
      output +=
        '<h3 class="standing-heading">IN THE HUNT</h3>';
    }

    output += `
      <div class="standing-row">
        <span class="standing-rank">
          ${index + 1}
        </span>

        ${logo(r.team, 'standing-logo')}

        <span class="standing-name">
          ${safe(shortName(r.team)).toUpperCase()}
        </span>

        <span class="standing-record">
          ${r.wins}-${r.losses}${r.ties ? '-' + r.ties : ''}
        </span>
      </div>
    `;
  });

  list.innerHTML = output;
}

/* AWARD WATCH */

function awardValue(entry, category) {
  if (category === 'mvp' || category === 'opoy') {
    return (
      number(entry.pass_yards) +
      number(entry.rush_yards) +
      number(entry.receiving_yards)
    );
  }

  if (category === 'dpoy') {
    return number(entry.tackles);
  }

  if (category === 'qb') {
    return number(entry.pass_yards);
  }

  if (category === 'wr') {
    return number(entry.receiving_yards);
  }

  return 0;
}

function renderAwards() {
  const list = $('awardList');
  if (!list) return;

  const category = $('awardSelect')?.value || 'mvp';

  const leaders = [...state.stats]
    .filter(entry => getPlayer(entry.player_id))
    .sort(
      (a, b) =>
        awardValue(b, category) -
        awardValue(a, category)
    )
    .slice(0, 5);

  if (!leaders.length) {
    empty(
      'awardList',
      'Award candidates will appear when stats are entered.'
    );
    return;
  }

  const unit = category === 'dpoy' ? 'TKL' : 'YDS';

  list.innerHTML = leaders.map((entry, index) => {
    const player = getPlayer(entry.player_id);

    const team = getTeam(
      entry.team_id || player?.team_id
    );

    return `
      <div class="award-row">
        <strong class="award-rank">
          ${index + 1}
        </strong>

        ${logo(team, 'award-logo')}

        <span class="award-player">
          ${safe(player.display_name || player.username)}
        </span>

        <strong class="award-score">
          ${format(awardValue(entry, category))}
          <small>${unit}</small>
        </strong>
      </div>
    `;
  }).join('') + `
    <p style="font-size:10px;color:var(--muted);margin:12px 0 0">
      Statistical preview only.
      Not official award voting or point totals.
    </p>
  `;
}

/* WEEK SELECTOR */

function setupWeekSelector() {
  const select = $('weekSelect');
  if (!select) return;

  const weeks = [
    ...new Set(
      state.games.map(game => game.week)
    )
  ].sort((a, b) => a - b);

  if (!weeks.length) return;

  select.innerHTML = weeks.map(
    week =>
      `<option value="${week}">Week ${week}</option>`
  ).join('');

  state.selectedWeek = weeks.includes(state.currentWeek)
    ? state.currentWeek
    : weeks.at(-1);

  select.value = String(state.selectedWeek);
}

/* DARK MODE */

function setupTheme() {
  const theme = localStorage.getItem('ufl-theme');

  if (theme === 'dark') {
    document.body.classList.add('dark-mode');
  }

  $('themeToggle')?.addEventListener('click', () => {
    const active = document.body.classList.toggle(
      'dark-mode'
    );

    localStorage.setItem(
      'ufl-theme',
      active ? 'dark' : 'light'
    );
  });
}

/* DISCORD PROFILE */

function showProfile(user) {
  const image = $('discordAvatar');
  const fallback = $('avatarFallback');

  if (!image || !fallback) return;

  const avatar =
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.picture;

  if (user && /^https:\/\//.test(avatar || '')) {
    image.src = avatar;
    image.hidden = false;
    fallback.hidden = true;
  } else {
    image.hidden = true;
    fallback.hidden = false;

    fallback.textContent = user
      ? String(
          user.user_metadata?.full_name ||
          user.email ||
          'U'
        )[0].toUpperCase()
      : 'U';
  }

  $('discordLogin')?.setAttribute(
    'aria-label',
    user
      ? 'Discord account menu'
      : 'Sign in with Discord'
  );
}

async function setupDiscordLogin() {
  if (!db) return;

  try {
    const { data } = await db.auth.getUser();

    state.signedInUser = data?.user ?? null;

    showProfile(state.signedInUser);
  } catch (error) {
    console.warn(
      'Discord session could not be checked:',
      error
    );
  }

  db.auth.onAuthStateChange((_event, session) => {
    state.signedInUser = session?.user ?? null;
    showProfile(state.signedInUser);
  });

  $('discordLogin')?.addEventListener(
    'click',
    async () => {
      if (state.signedInUser) {
        const name =
          state.signedInUser.user_metadata?.full_name ||
          state.signedInUser.email ||
          'Discord user';

        if (window.confirm(
          `Signed in as ${name}. Sign out?`
        )) {
          await db.auth.signOut();
        }

        return;
      }

      const { error } = await db.auth.signInWithOAuth({
        provider: 'discord',
        options: {
          redirectTo:
            `${location.origin}${location.pathname}`
        }
      });

      if (error) {
        alert(
          'Discord login needs to be enabled in Supabase first. ' +
          error.message
        );
      }
    }
  );
}

/* BUTTON EVENTS */

function setupActions() {
  $('weekSelect')?.addEventListener(
    'change',
    event => {
      state.selectedWeek = Number(event.target.value);
      renderMatchups();
    }
  );

  $('statSelect')?.addEventListener(
    'change',
    event => {
      state.stat = event.target.value;
      renderStats();
    }
  );

  $('conferenceSelect')?.addEventListener(
    'change',
    event => {
      state.conference = event.target.value;
      renderStandings();
    }
  );

  $('awardSelect')?.addEventListener(
    'change',
    renderAwards
  );

  $('notificationButton')?.addEventListener(
    'click',
    () => alert('No new UFL notifications yet.')
  );
}

/* SUPABASE DATA */

async function getRows(table, columns = '*') {
  const { data, error } = await db
    .from(table)
    .select(columns)
    .limit(1000);

  if (error) {
    throw new Error(`${table}: ${error.message}`);
  }

  return data || [];
}

async function loadLeague() {
  if (!db) {
    for (const id of [
      'matchupsList',
      'statLeaders',
      'standingsList',
      'awardList'
    ]) {
      empty(
        id,
        'Could not start the database. Check the Supabase script.'
      );
    }

    return;
  }

  const requests = [
    ['teams', 'ufl_teams'],
    ['games', 'ufl_games'],
    ['players', 'ufl_players'],
    ['stats', 'ufl_player_season_stats'],
    ['settings', 'ufl_settings'],
    ['rankings', 'ufl_power_rankings']
  ];

  const results = await Promise.allSettled(
    requests.map(([, table]) => getRows(table))
  );

  results.forEach((result, index) => {
    const [key] = requests[index];

    if (result.status === 'fulfilled') {
      state[key] = result.value;
    } else {
      console.error(
        'UFL data failed:',
        result.reason
      );
    }
  });

  state.teams = state.teams.filter(
    team => team.is_active !== false
  );

  state.currentWeek =
    number(setting('current_week', 4)) || 4;

  setupWeekSelector();

  if (!state.teams.length) {
    for (const id of [
      'matchupsList',
      'statLeaders',
      'standingsList',
      'awardList'
    ]) {
      empty(
        id,
        'Team data unavailable. Check Supabase.'
      );
    }

    return;
  }

  renderMatchups();
  renderStats();
  renderStandings();
  renderAwards();
}

/* START WEBSITE */

setupTheme();
setupActions();
setupDiscordLogin();
loadLeague();
