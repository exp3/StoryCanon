import type { Locale } from "@/lib/i18n";

/**
 * Content for the demo work a new account can pull in with one click.
 *
 * It is deliberately the same story the landing page's hero mock shows ("The
 * Observer of Nagi" / 凪の街の観測者), down to the story-state lines: someone
 * who clicked through from the landing page should recognise the screen they
 * were just looking at.
 *
 * The point is not the prose. It is that every entity type has something in it,
 * because the empty dashboard was asking people to fill thirteen empty forms
 * before the product could show them what it was for.
 *
 * Prisma-free on purpose, like lib/plan-limits.ts: the cross-references between
 * entities are plain array indexes, and a unit test can only check they are in
 * range if importing this does not need a database.
 */

export type SampleScene = {
  title: string;
  body: string;
  summary: string;
  occurredEvents: string;
  createdBy: "USER" | "CHATGPT";
};

export type SampleData = {
  project: { title: string; genre: string; premise: string; tone: string; writingStyle: string };
  chapter: { title: string; summary: string; purpose: string };
  scenes: SampleScene[];
  characters: {
    name: string;
    role: string;
    age: string;
    personality: string;
    speechStyle: string;
    background: string;
    goal: string;
    secret: string;
    currentState: string;
  }[];
  /** `character` indexes into `characters`. */
  characterNotes: {
    character: number;
    title: string;
    body: string;
    category: "INNER" | "RELATIONSHIP" | "BACKGROUND" | "SPEECH" | "PLOT" | "OTHER";
    importance: "LOW" | "MEDIUM" | "HIGH";
  }[];
  worldNotes: {
    title: string;
    body: string;
    category: "PLACE" | "ORGANIZATION" | "TECHNOLOGY" | "HISTORY" | "CULTURE" | "ITEM" | "RULE" | "OTHER";
    importance: "LOW" | "MEDIUM" | "HIGH";
  }[];
  /** `plantedScene` indexes into `scenes`. */
  foreshadowings: {
    title: string;
    description: string;
    plannedResolution: string;
    plantedScene: number | null;
    status: "UNPLANTED" | "PLANTED" | "IN_PROGRESS" | "RESOLVED" | "DROPPED";
    importance: "LOW" | "MEDIUM" | "HIGH";
  }[];
  mysteries: {
    scope: "CENTRAL" | "ARC" | "EPISODE" | "SCENE";
    question: string;
    truth: string;
    knownBy: string;
    clues: string;
    revealPoint: string;
  }[];
  plotThreads: {
    title: string;
    description: string;
    status: "NOT_STARTED" | "IN_PROGRESS" | "ON_HOLD" | "RESOLVED" | "DROPPED";
    currentState: string;
    resolutionCondition: string;
  }[];
  revisionTodos: {
    title: string;
    problem: string;
    suggestion: string;
    priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    /** Indexes into `scenes`, or null for a work-level note. */
    scene: number | null;
  }[];
  storyState: {
    summary: string;
    recentEvents: string;
    characterStates: string;
    unresolvedProblems: string;
    unresolvedForeshadowings: string;
    activePlotThreads: string;
    nextOptions: string;
  };
  timelineTags: string[];
  /** `tags` indexes into `timelineTags`, `characters` into `characters`. */
  timelineEvents: {
    title: string;
    description: string;
    occurredAt: string;
    tags: number[];
    characters: number[];
  }[];
};

const ja: SampleData = {
  project: {
    title: "凪の街の観測者",
    genre: "幻想ミステリ",
    premise:
      "海に面した凪の街には、百年ぶんの天候を記録し続けている観測塔がある。失踪した姉を探して街へ戻った深瀬灯は、塔の記録簿の余白に、姉のものとしか思えない筆跡を見つける。",
    tone: "静かで、湿度のある文体。派手な事件よりも、記録と記憶のずれを追う。",
    writingStyle: "三人称一元視点（灯）。海と天候の描写を各シーンに一箇所は置く。",
  },
  chapter: {
    title: "第一章 観測塔",
    summary: "灯が凪の街へ戻り、観測塔の記録簿に姉の筆跡を見つけるまで。",
    purpose: "街と塔のルールを読者に渡し、中心の謎（誰が記録を書き換えたか）を提示する。",
  },
  scenes: [
    {
      title: "記録簿の余白",
      body: `　観測塔の階段は、上るほどに潮の匂いが濃くなった。海から離れていくはずなのに、と灯は思う。この街の理屈は、いつもどこかが裏返っている。
　最上階の記録室には、天井まで届く棚が三方を埋めていた。革の背表紙が、年号の順に並んでいる。灯は指を滑らせ、姉が消えた年の一冊を引き抜いた。
　紙は思ったより軽い。ひらくと、几帳面な数字が整然と並んでいた。気圧、風向、波高。観測者の手は震えひとつない。
　七月十日のページで、指が止まった。
　余白に、鉛筆で短く書き込みがある。数字ではない。文字だ。
　——まだ、凪がこない。
　灯はその六文字を何度も読んだ。丸みを帯びた「な」の書きかた。とめの位置。見間違えようがなかった。姉の字だった。
　窓の外では、海が動かないまま光っていた。`,
      summary: "灯が観測塔の記録室で、姉の失踪した年の記録簿を調べ、余白に姉の筆跡の書き込みを見つける。",
      occurredEvents: "灯が観測塔に入る／七月十日のページに姉の筆跡を発見する",
      createdBy: "USER",
    },
    {
      title: "港の管理人",
      body: `　郷田の詰所は、桟橋の根元にあった。まっすぐに建てられたはずの小屋が、地面ごとわずかに傾いでいる。
　「深瀬さんとこの、下の子か」
　振り向きもせずに郷田は言った。手元では古い網が繕われていく。指の動きだけが若い。
　「姉のことで来ました」
　網を持つ手が、一度だけ止まった。ほんの半拍だった。
　「あの子は塔の記録係だった。それ以上のことは、おれは知らん」
　「記録簿に、姉の字で書き込みがありました。観測値の欄じゃなくて、余白に」
　郷田は答えなかった。かわりに、網を膝から下ろして立ち上がり、窓のほうを向いた。桟橋の向こうで、海はやはり動いていない。
　「この街ではな」と郷田は言った。「凪が長すぎるときは、誰かが記録を止めてる」`,
      summary: "灯が港の管理人・郷田を訪ね、姉が記録係だったことと「凪が長すぎるときは誰かが記録を止めている」という言葉を得る。",
      occurredEvents: "灯が郷田を訪ねる／郷田が姉の役職を明かす／郷田が記録と凪の関係を示唆する",
      createdBy: "CHATGPT",
    },
  ],
  characters: [
    {
      name: "深瀬 灯",
      role: "主人公",
      age: "22",
      personality: "観察が先に立ち、感情の言語化が遅れる。粘り強いが、粘っている自覚がない。",
      speechStyle: "短く区切る。敬語と常体が混ざる。質問は直球。",
      background: "十八で街を出た。姉の失踪の報せで四年ぶりに戻る。",
      goal: "姉が最後に何を記録しようとしていたのかを知る。",
      secret: "姉が消える前夜、電話を一度、意図的に取らなかった。",
      currentState: "観測塔の記録簿に姉の筆跡を見つけ、郷田に接触した直後。",
    },
    {
      name: "深瀬 澪",
      role: "姉・失踪者",
      age: "26（失踪時）",
      personality: "几帳面で、他人に説明をしない。決めたことを先に実行する。",
      speechStyle: "丁寧語。言い切りを避ける。",
      background: "観測塔の記録係を四年務めた。街を出た灯とは連絡が途絶えがちだった。",
      goal: "（不明。記録の欠落と関係する）",
      secret: "記録簿の余白に、観測値ではないものを書き残していた。",
      currentState: "失踪したまま。作中では記録と証言を通してのみ現れる。",
    },
    {
      name: "郷田 敬三",
      role: "港の管理人",
      age: "六十代",
      personality: "無口だが、質問を遮らない。知っていることと言えることを分けている。",
      speechStyle: "方言混じりの短い断定。主語を省く。",
      background: "四十年、桟橋の管理を続けている。先代の観測者を知る数少ない人物。",
      goal: "街の均衡を崩さないこと。",
      secret: "澪が失踪した夜、桟橋の灯りを落としたのは郷田自身。",
      currentState: "灯に対して、核心の手前までを話した。",
    },
  ],
  characterNotes: [
    {
      character: 0,
      title: "灯にとっての「記録」",
      body: "灯は記録を、事実の保存ではなく「取り返しのつかなさの証拠」として見ている。だから記録簿の改竄に、事件そのものより強く反応する。",
      category: "INNER",
      importance: "HIGH",
    },
    {
      character: 0,
      title: "灯と澪の距離",
      body: "仲が悪かったわけではない。灯が街を出たことを澪が一度も責めなかったこと自体が、灯にとっては負債になっている。",
      category: "RELATIONSHIP",
      importance: "MEDIUM",
    },
    {
      character: 2,
      title: "郷田の話しかた",
      body: "「〜だ」「〜ん」で切る。灯を名前で呼ばず「下の子」と呼び続ける。名前を呼んだときが、態度が変わった合図。",
      category: "SPEECH",
      importance: "MEDIUM",
    },
  ],
  worldNotes: [
    {
      title: "凪の街",
      body: "湾の奥にあり、年の三分の一は風がほとんど吹かない。凪が二週間を超えると漁が止まり、街の空気が変わる。人口およそ四千。",
      category: "PLACE",
      importance: "HIGH",
    },
    {
      title: "観測塔",
      body: "百二年前に建てられた気象観測塔。最上階が記録室。記録係は常に一名で、任期の定めはない。街の予算ではなく、旧い漁業組合の基金で維持されている。",
      category: "PLACE",
      importance: "HIGH",
    },
    {
      title: "記録簿の規則",
      body: "一日一ページ。鉛筆で記入し、消しゴムの使用は禁止。訂正は二重線と押印。余白への記入は明確に規則違反にあたる。",
      category: "RULE",
      importance: "HIGH",
    },
    {
      title: "凪と漁の関係",
      body: "凪が続くと湾内の酸素が落ち、魚が沖へ出る。漁師は凪の長さを収入の目盛りとして見ており、天候記録は生活に直結している。",
      category: "CULTURE",
      importance: "MEDIUM",
    },
  ],
  foreshadowings: [
    {
      title: "余白の書き込み「まだ、凪がこない」",
      description: "澪の筆跡で記録簿の余白に残された一文。日付は失踪の前日。",
      plannedResolution: "終盤で、この一文が観測記録ではなく合図だったと判明する。",
      plantedScene: 0,
      status: "PLANTED",
      importance: "HIGH",
    },
    {
      title: "郷田が半拍だけ手を止める",
      description: "姉の名を出したとき、網を繕う手が一度だけ止まる。本人は気づかせないつもりでいる。",
      plannedResolution: "郷田が失踪当夜に桟橋の灯りを落としたことの伏線として回収する。",
      plantedScene: 1,
      status: "PLANTED",
      importance: "MEDIUM",
    },
    {
      title: "傾いだ詰所",
      description: "郷田の詰所だけが地面ごと傾いている。街の他の建物は傾いていない。",
      plannedResolution: "埋め立て以前の地形と、旧い基金の出どころに繋がる。",
      plantedScene: 1,
      status: "PLANTED",
      importance: "LOW",
    },
    {
      title: "取らなかった電話",
      description: "灯が失踪前夜に姉からの電話を意図的に取らなかったこと。まだ誰にも話していない。",
      plannedResolution: "灯が郷田に自分の負い目を明かす場面で表に出す。",
      plantedScene: null,
      status: "UNPLANTED",
      importance: "HIGH",
    },
  ],
  mysteries: [
    {
      scope: "CENTRAL",
      question: "記録簿を書き換えたのは誰か。そして、なぜ凪の記録だけが欠けているのか。",
      truth: "澪自身が、ある事実を隠すために記録を止めた。書き換えたのは澪であり、隠した相手は郷田ではなく街の側。",
      knownBy: "澪（当事者）／郷田（半分だけ察している）",
      clues: "余白の書き込み／七月の気圧記録の欠落／郷田の証言「誰かが記録を止めてる」",
      revealPoint: "第三章の終盤、灯が基金の帳簿に辿り着いたとき。",
    },
  ],
  plotThreads: [
    {
      title: "澪の失踪を追う",
      description: "灯が姉の足取りを、記録と証言から再構成していく本筋。",
      status: "IN_PROGRESS",
      currentState: "記録簿の筆跡を確認し、郷田から最初の証言を得た段階。",
      resolutionCondition: "澪が最後に記録しようとしていた内容が判明すること。",
    },
    {
      title: "郷田の沈黙",
      description: "郷田が何を知りながら黙っているのかを、灯が崩していく副線。",
      status: "NOT_STARTED",
      currentState: "郷田は核心の手前で話を止めた。まだ押していない。",
      resolutionCondition: "郷田が灯を名前で呼ぶこと。",
    },
  ],
  revisionTodos: [
    {
      title: "第一章の時系列が曖昧",
      problem: "灯が街に着いた日と、塔に上がった日が同じなのか翌日なのかが本文から読み取れない。",
      suggestion: "冒頭に一行、宿に荷物を置いた描写を足して日をまたがせる。",
      priority: "MEDIUM",
      scene: 0,
    },
    {
      title: "郷田の口調が揺れている",
      problem: "「〜だ」で切る設定なのに、後半で丁寧語が混ざっている。",
      suggestion: "キャラクターノート「郷田の話しかた」に合わせて統一する。",
      priority: "LOW",
      scene: 1,
    },
    {
      title: "海の描写が繰り返しになっている",
      problem: "第一場面で「動かないまま光っていた」、第二場面で「やはり動いていない」。反復が意図的に見えない。",
      suggestion: "どちらかを残して他方を変えるか、モチーフとして意図的に反復していると分かる形にする。",
      priority: "HIGH",
      scene: null,
    },
  ],
  storyState: {
    summary:
      "灯は観測塔の記録簿に姉の筆跡を見つけ、港の管理人・郷田から「凪が長すぎるときは誰かが記録を止めている」という言葉を得た。街の側はまだ何も動いていない。",
    recentEvents: "観測塔の記録室に入る／七月十日の余白に姉の書き込みを発見／郷田を訪ね、最初の証言を得る",
    characterStates: "灯: 姉の筆跡を確認し、確信に変わりつつある。郷田: 核心の手前で話を止めた。",
    unresolvedProblems: "記録を書き換えた人物は誰か。七月の気圧記録が欠けている理由。",
    unresolvedForeshadowings: "余白の書き込み／郷田が手を止めた半拍／傾いだ詰所／取らなかった電話",
    activePlotThreads: "澪の失踪を追う（進行中）／郷田の沈黙（未着手）",
    nextOptions: "港の管理人をもう一度訪ねる／漁業組合の基金の帳簿を当たる／記録係の後任に会う",
  },
  timelineTags: ["観測塔", "証言"],
  timelineEvents: [
    {
      title: "澪が失踪する",
      description: "記録簿の最後の記入の翌日。桟橋の灯りが落ちていた夜。",
      occurredAt: "四年前 七月十一日",
      tags: [0],
      characters: [1, 2],
    },
    {
      title: "灯が凪の街へ戻る",
      description: "四年ぶり。その足で観測塔に上がる。",
      occurredAt: "現在 七月九日",
      tags: [],
      characters: [0],
    },
    {
      title: "灯が余白の書き込みを見つける",
      description: "七月十日のページ。「まだ、凪がこない」。",
      occurredAt: "現在 七月九日",
      tags: [0, 1],
      characters: [0],
    },
  ],
};

const en: SampleData = {
  project: {
    title: "The Observer of Nagi",
    genre: "Quiet fantasy mystery",
    premise:
      "The seaside town of Nagi keeps a weather tower that has logged a century of wind and pressure. Akari Fukase comes home to look for her missing sister and finds, in the margin of the logbook, handwriting that can only be hers.",
    tone: "Still and humid. The story follows the gap between what was recorded and what was remembered, not a chase.",
    writingStyle: "Third person limited (Akari). Put the sea or the weather somewhere in every scene.",
  },
  chapter: {
    title: "Chapter 1 — The Tower",
    summary: "Akari returns to Nagi and finds her sister's handwriting in the observatory log.",
    purpose: "Hand the reader the town's rules and pose the central question: who altered the record?",
  },
  scenes: [
    {
      title: "The Margin of the Log",
      body: `The stairs of the tower smelled more of salt the higher she climbed. It should have been the other way round, Akari thought. In this town the logic always turned over somewhere.

The record room at the top was shelved on three sides, up to the ceiling. Leather spines in order of year. She ran a finger along them and pulled out the volume for the year her sister disappeared.

The paper was lighter than she expected. Inside, careful figures marched in rows. Pressure, wind, wave height. The observer's hand had never once shaken.

At the page for the tenth of July, her finger stopped.

There was something in the margin, in pencil. Not a number. Words.

*The calm still hasn't come.*

She read the six words several times. The round turn of the letters. Where the strokes stopped. There was no mistaking it. It was her sister's hand.

Outside the window, the sea lay lit and motionless.`,
      summary:
        "Akari searches the year's logbook in the tower's record room and finds a pencilled note in her sister's handwriting.",
      occurredEvents: "Akari enters the tower / finds her sister's handwriting on the page for 10 July",
      createdBy: "USER",
    },
    {
      title: "The Harbour Keeper",
      body: `Goda's hut stood at the root of the pier. A building put up straight had settled crooked, ground and all.

"You'd be the Fukase girl. The younger one."

He said it without turning round. His hands went on mending an old net. Only the fingers moved like a young man's.

"I've come about my sister."

The hands stopped once. Half a beat, no more.

"She kept the log up at the tower. Beyond that I don't know anything."

"There's writing in the logbook in her hand. Not in the observation column. In the margin."

Goda did not answer. He set the net down off his knees, stood, and turned to the window. Past the pier the sea was still not moving.

"In this town," he said, "when the calm runs too long, somebody's stopped the record."`,
      summary:
        "Akari visits Goda, the harbour keeper, and learns her sister was the tower's record keeper — and that a long calm means someone has stopped the record.",
      occurredEvents: "Akari visits Goda / Goda names her sister's role / Goda hints at the link between the record and the calm",
      createdBy: "CHATGPT",
    },
  ],
  characters: [
    {
      name: "Akari Fukase",
      role: "Protagonist",
      age: "22",
      personality: "Observes first and names her feelings late. Persistent without noticing that she is.",
      speechStyle: "Short clauses. Slips between formal and plain. Asks direct questions.",
      background: "Left the town at eighteen. Comes back after four years when her sister is reported missing.",
      goal: "To learn what her sister was trying to record before she vanished.",
      secret: "The night before the disappearance, she deliberately let her sister's call ring out.",
      currentState: "Has just confirmed the handwriting and made contact with Goda.",
    },
    {
      name: "Mio Fukase",
      role: "The missing sister",
      age: "26 at the time of her disappearance",
      personality: "Meticulous. Explains herself to nobody. Acts on a decision before announcing it.",
      speechStyle: "Polite register. Avoids flat assertions.",
      background: "Kept the tower's log for four years. Contact with Akari had grown thin.",
      goal: "(Unknown — tied to the gap in the record.)",
      secret: "She had been writing something other than observations in the margins.",
      currentState: "Still missing. Present in the story only through records and testimony.",
    },
    {
      name: "Keizo Goda",
      role: "Harbour keeper",
      age: "Sixties",
      personality: "Taciturn, but never cuts off a question. Keeps what he knows separate from what he can say.",
      speechStyle: "Short flat statements, local turn of phrase, subject often dropped.",
      background: "Forty years on the pier. One of the few who knew the previous observer.",
      goal: "To keep the town's balance from tipping.",
      secret: "He was the one who cut the pier lights the night Mio disappeared.",
      currentState: "Has told Akari everything up to the edge of the thing itself.",
    },
  ],
  characterNotes: [
    {
      character: 0,
      title: "What a record means to Akari",
      body: "She reads records not as preserved fact but as proof that something cannot be taken back. That is why the tampering hits her harder than the disappearance.",
      category: "INNER",
      importance: "HIGH",
    },
    {
      character: 0,
      title: "The distance between the sisters",
      body: "They had not fallen out. That Mio never once blamed her for leaving is exactly what Akari carries as a debt.",
      category: "RELATIONSHIP",
      importance: "MEDIUM",
    },
    {
      character: 2,
      title: "How Goda speaks",
      body: "Flat endings, dropped subjects. He never uses Akari's name — she stays \"the younger one\". The moment he uses her name is the signal that his stance has changed.",
      category: "SPEECH",
      importance: "MEDIUM",
    },
  ],
  worldNotes: [
    {
      title: "The town of Nagi",
      body: "Set at the back of a bay where the wind drops for a third of the year. Past two weeks of calm the fishing stops and the mood of the town changes. Population about four thousand.",
      category: "PLACE",
      importance: "HIGH",
    },
    {
      title: "The observatory tower",
      body: "A weather tower built a hundred and two years ago; the record room is at the top. There is always exactly one keeper, with no fixed term. Maintained by an old fishery-guild fund rather than the town budget.",
      category: "PLACE",
      importance: "HIGH",
    },
    {
      title: "Rules of the logbook",
      body: "One page a day, in pencil, erasers forbidden. Corrections are struck through twice and stamped. Writing in the margin is plainly against the rules.",
      category: "RULE",
      importance: "HIGH",
    },
    {
      title: "Calm and the catch",
      body: "A long calm drops the oxygen in the bay and the fish move offshore. The fishermen read the length of a calm as a measure of income, which ties the weather record directly to how people live.",
      category: "CULTURE",
      importance: "MEDIUM",
    },
  ],
  foreshadowings: [
    {
      title: "The margin note: \"The calm still hasn't come\"",
      description: "One line in Mio's hand in the logbook margin, dated the day before she disappeared.",
      plannedResolution: "Late on, it turns out the line was a signal rather than an observation.",
      plantedScene: 0,
      status: "PLANTED",
      importance: "HIGH",
    },
    {
      title: "Goda's hands stop for half a beat",
      description: "When the sister's name comes up, the mending stops once. He means for it to go unnoticed.",
      plannedResolution: "Pays off as the seed for his having cut the pier lights that night.",
      plantedScene: 1,
      status: "PLANTED",
      importance: "MEDIUM",
    },
    {
      title: "The crooked hut",
      description: "Goda's hut alone has settled with the ground under it. Nothing else in town leans.",
      plannedResolution: "Connects to the shape of the shore before the landfill, and to where the old fund came from.",
      plantedScene: 1,
      status: "PLANTED",
      importance: "LOW",
    },
    {
      title: "The call she didn't take",
      description: "Akari deliberately let her sister's call ring out the night before. She has told no one.",
      plannedResolution: "Surfaces when Akari finally admits her own debt to Goda.",
      plantedScene: null,
      status: "UNPLANTED",
      importance: "HIGH",
    },
  ],
  mysteries: [
    {
      scope: "CENTRAL",
      question: "Who altered the logbook, and why is it only the record of the calm that is missing?",
      truth:
        "Mio stopped the record herself, to hide something. The one she was hiding it from was not Goda but the town.",
      knownBy: "Mio (as the one who did it) / Goda (has guessed half of it)",
      clues: "The margin note / the gap in July's pressure readings / Goda's line about someone stopping the record",
      revealPoint: "Late in chapter three, when Akari reaches the fund's ledgers.",
    },
  ],
  plotThreads: [
    {
      title: "Tracing Mio's disappearance",
      description: "The main line: Akari reconstructs her sister's last movements from records and testimony.",
      status: "IN_PROGRESS",
      currentState: "Handwriting confirmed; first testimony obtained from Goda.",
      resolutionCondition: "Learning what Mio was last trying to record.",
    },
    {
      title: "Goda's silence",
      description: "The counter-line: Akari works out what he knows and is not saying.",
      status: "NOT_STARTED",
      currentState: "He stopped short of the thing itself. She has not pushed yet.",
      resolutionCondition: "Goda calls her by her name.",
    },
  ],
  revisionTodos: [
    {
      title: "Chapter 1's timeline is vague",
      problem: "Nothing in the text says whether Akari climbs the tower the day she arrives or the next day.",
      suggestion: "Add a line at the opening about dropping her bag at the inn, to push it over into the next day.",
      priority: "MEDIUM",
      scene: 0,
    },
    {
      title: "Goda's register drifts",
      problem: "He is meant to speak in flat endings, but the second half slides into a politer register.",
      suggestion: "Bring it back in line with the character note \"How Goda speaks\".",
      priority: "LOW",
      scene: 1,
    },
    {
      title: "Decide how the sea is described",
      problem: "The sea is \"motionless\" in one scene and \"still not moving\" in the next; the repetition reads as accidental.",
      suggestion: "Keep one of them and vary the other, or make the repetition deliberate and mark it as a motif.",
      priority: "HIGH",
      scene: null,
    },
  ],
  storyState: {
    summary:
      "Akari has found her sister's handwriting in the tower's log and drawn her first line out of Goda: when the calm runs too long, someone has stopped the record. The town itself has not yet moved.",
    recentEvents:
      "Enters the record room / finds the margin note on 10 July / visits Goda and gets a first testimony",
    characterStates: "Akari: the handwriting has turned suspicion into certainty. Goda: stopped short of the thing itself.",
    unresolvedProblems: "Who altered the record. Why July's pressure readings are missing.",
    unresolvedForeshadowings: "The margin note / Goda's half beat / the crooked hut / the call she didn't take",
    activePlotThreads: "Tracing Mio's disappearance (in progress) / Goda's silence (not started)",
    nextOptions: "Visit the harbour keeper again / go after the fishery fund's ledgers / find the current record keeper",
  },
  timelineTags: ["Tower", "Testimony"],
  timelineEvents: [
    {
      title: "Mio disappears",
      description: "The day after the last entry in the log. The night the pier lights were out.",
      occurredAt: "Four years ago, 11 July",
      tags: [0],
      characters: [1, 2],
    },
    {
      title: "Akari returns to Nagi",
      description: "After four years. She goes straight up the tower.",
      occurredAt: "Present, 9 July",
      tags: [],
      characters: [0],
    },
    {
      title: "Akari finds the margin note",
      description: "The page for 10 July. \"The calm still hasn't come.\"",
      occurredAt: "Present, 9 July",
      tags: [0, 1],
      characters: [0],
    },
  ],
};

export const SAMPLES: Record<Locale, SampleData> = { en, ja };

export function sampleProjectTitle(locale: Locale) {
  return SAMPLES[locale].project.title;
}

