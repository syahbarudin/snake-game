import { useCallback, useEffect, useRef, useState } from 'react'

const BOARD_SIZE = 20
const STARTING_SNAKE = [
  { x: 8, y: 10 },
  { x: 7, y: 10 },
  { x: 6, y: 10 },
]
const DIRECTIONS = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  w: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
  a: { x: -1, y: 0 },
  d: { x: 1, y: 0 },
}
const OPPOSITE = {
  '0,-1': '0,1',
  '0,1': '0,-1',
  '-1,0': '1,0',
  '1,0': '-1,0',
}

function createFood(snake) {
  const emptyCells = []
  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      if (!snake.some((segment) => segment.x === x && segment.y === y)) {
        emptyCells.push({ x, y })
      }
    }
  }
  return emptyCells[Math.floor(Math.random() * emptyCells.length)] ?? null
}

function createGame() {
  return {
    snake: STARTING_SNAKE.map((segment) => ({ ...segment })),
    food: { x: 14, y: 10 },
    direction: { x: 1, y: 0 },
    score: 0,
    status: 'ready',
  }
}

function readBestScore() {
  const score = Number(window.localStorage.getItem('snake-best-score'))
  return Number.isFinite(score) && score > 0 ? score : 0
}

function App() {
  const [game, setGame] = useState(createGame)
  const [bestScore, setBestScore] = useState(readBestScore)
  const gameRef = useRef(game)
  const queuedDirection = useRef(null)

  const updateGame = useCallback((nextGame) => {
    gameRef.current = nextGame
    setGame(nextGame)
  }, [])

  const startGame = useCallback(() => {
    const current = gameRef.current
    if (current.status === 'ready' || current.status === 'paused') {
      updateGame({ ...current, status: 'running' })
    } else if (current.status === 'over' || current.status === 'won') {
      queuedDirection.current = null
      updateGame({ ...createGame(), status: 'running' })
    }
  }, [updateGame])

  const changeDirection = useCallback(
    (nextDirection) => {
      const current = gameRef.current
      if (current.status === 'over' || current.status === 'won') return

      const previousDirection = queuedDirection.current ?? current.direction
      const previousKey = `${previousDirection.x},${previousDirection.y}`
      const nextKey = `${nextDirection.x},${nextDirection.y}`
      if (OPPOSITE[previousKey] === nextKey) return

      queuedDirection.current = nextDirection
      if (current.status === 'ready') {
        updateGame({ ...current, status: 'running' })
      }
    },
    [updateGame],
  )

  useEffect(() => {
    const handleKeyDown = (event) => {
      const nextDirection = DIRECTIONS[event.key] ?? DIRECTIONS[event.key.toLowerCase()]
      if (nextDirection) {
        event.preventDefault()
        changeDirection(nextDirection)
        return
      }

      if (event.code === 'Space') {
        event.preventDefault()
        const current = gameRef.current
        if (current.status === 'running') {
          updateGame({ ...current, status: 'paused' })
        } else if (current.status === 'ready' || current.status === 'paused') {
          updateGame({ ...current, status: 'running' })
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [changeDirection, updateGame])

  useEffect(() => {
    if (game.status !== 'running') return undefined

    const timer = window.setInterval(() => {
      const current = gameRef.current
      const direction = queuedDirection.current ?? current.direction
      queuedDirection.current = null
      const head = {
        x: current.snake[0].x + direction.x,
        y: current.snake[0].y + direction.y,
      }
      const eating = head.x === current.food.x && head.y === current.food.y
      const bodyToCheck = eating ? current.snake : current.snake.slice(0, -1)
      const hitWall =
        head.x < 0 || head.x >= BOARD_SIZE || head.y < 0 || head.y >= BOARD_SIZE
      const hitSelf = bodyToCheck.some(
        (segment) => segment.x === head.x && segment.y === head.y,
      )

      if (hitWall || hitSelf) {
        updateGame({ ...current, direction, status: 'over' })
        return
      }

      const snake = [head, ...current.snake]
      if (!eating) snake.pop()

      if (eating && snake.length === BOARD_SIZE * BOARD_SIZE) {
        updateGame({ ...current, snake, direction, food: null, status: 'won', score: current.score + 1 })
        return
      }

      updateGame({
        ...current,
        snake,
        direction,
        food: eating ? createFood(snake) : current.food,
        score: current.score + Number(eating),
      })
    }, Math.max(75, 150 - game.score * 4))

    return () => window.clearInterval(timer)
  }, [game.score, game.status, updateGame])

  useEffect(() => {
    if (game.score > bestScore) {
      setBestScore(game.score)
      window.localStorage.setItem('snake-best-score', String(game.score))
    }
  }, [bestScore, game.score])

  const snakeCells = new Set(game.snake.map((segment) => `${segment.x},${segment.y}`))
  const overlay = {
    ready: {
      eyebrow: 'SIAP-SIAP',
      title: 'Siap bermain?',
      message: 'Ambil makanan, tumbuh lebih panjang, dan jangan menabrak.',
      action: 'Mulai main',
    },
    paused: {
      eyebrow: 'JEDA',
      title: 'Istirahat dulu',
      message: 'Game kamu aman. Lanjutkan saat sudah siap.',
      action: 'Lanjutkan',
    },
    over: {
      eyebrow: 'GAME OVER',
      title: 'Ular menabrak!',
      message: `Skor kamu ${game.score}. Coba lagi dan pecahkan rekor!`,
      action: 'Main lagi',
    },
    won: {
      eyebrow: 'LUAR BIASA',
      title: 'Papan penuh!',
      message: 'Kamu berhasil memenuhi seluruh papan. Main lagi?',
      action: 'Main lagi',
    },
  }[game.status]

  const cellContents = []
  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      const key = `${x},${y}`
      const snakeIndex = game.snake.findIndex(
        (segment) => segment.x === x && segment.y === y,
      )
      const isFood = game.food?.x === x && game.food?.y === y
      const cellClass = [
        'board-cell',
        snakeCells.has(key) && 'snake-cell',
        snakeIndex === 0 && 'snake-head',
        snakeIndex > 0 && snakeIndex === game.snake.length - 1 && 'snake-tail',
        isFood && 'food-cell',
      ]
        .filter(Boolean)
        .join(' ')

      cellContents.push(
        <div
          aria-label={
            snakeIndex === 0
              ? 'Kepala ular'
              : snakeIndex > 0
                ? 'Badan ular'
                : isFood
                  ? 'Makanan'
                  : undefined
          }
          className={cellClass}
          key={key}
        >
          {isFood && <span className="food-dot" />}
          {snakeIndex === 0 && <span className="snake-eyes" />}
        </div>,
      )
    }
  }

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Snake Arcade home">
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span>SNAKE<span className="brand-light">ARCADE</span></span>
        </a>
        <div className="topbar-note"><span className="live-dot" /> CLASSIC MODE</div>
      </header>

      <section className="game-layout" aria-label="Permainan Snake">
        <div className="game-intro">
          <p className="eyebrow"><span /> THE ORIGINAL, REIMAGINED</p>
          <h1>Keep it<br /><span>growing.</span></h1>
          <p className="intro-copy">
            Satu tujuan sederhana: makan, tumbuh, dan bertahan selama mungkin.
            Seberapa jauh kamu bisa pergi?
          </p>
          <div className="stats-row">
            <div className="stat-card">
              <span className="stat-label">SKOR</span>
              <strong>{String(game.score).padStart(2, '0')}</strong>
            </div>
            <div className="stat-divider" />
            <div className="stat-card">
              <span className="stat-label">REKOR</span>
              <strong>{String(bestScore).padStart(2, '0')}</strong>
            </div>
          </div>
          <div className="status-line">
            <span className={`status-indicator ${game.status}`} />
            <span>{game.status === 'running' ? 'SEDANG BERMAIN' : game.status === 'paused' ? 'GAME DIJEDA' : game.status === 'over' ? 'PERMAINAN SELESAI' : game.status === 'won' ? 'KAMU MENANG' : 'MENUNGGU PEMAIN'}</span>
          </div>
        </div>

        <div className="game-panel">
          <div className="panel-top">
            <div className="panel-label"><span className="panel-icon">✳</span> PLAYING FIELD</div>
            <button
              aria-label={game.status === 'running' ? 'Jeda permainan' : 'Mulai atau lanjutkan permainan'}
              className="icon-button"
              disabled={game.status === 'over' || game.status === 'won'}
              onClick={() => {
                if (game.status === 'running') {
                  updateGame({ ...gameRef.current, status: 'paused' })
                } else {
                  startGame()
                }
              }}
              type="button"
            >
              {game.status === 'running' ? 'Ⅱ' : '▶'}
            </button>
          </div>
          <div className="board-frame">
            <div
              aria-label={`Papan Snake, skor ${game.score}`}
              className="game-board"
              role="img"
            >
              {cellContents}
            </div>
            {overlay && (
              <div className="board-overlay">
                <div className="overlay-card">
                  <span className="overlay-eyebrow">{overlay.eyebrow}</span>
                  <h2>{overlay.title}</h2>
                  <p>{overlay.message}</p>
                  <button className="primary-button" onClick={startGame} type="button">
                    {overlay.action}<span aria-hidden="true">→</span>
                  </button>
                  {game.status === 'ready' && <span className="overlay-hint">ATAU TEKAN TOMBOL ARAH</span>}
                </div>
              </div>
            )}
          </div>
          <div className="panel-bottom">
            <span><i className="food-legend" /> MAKANAN</span>
            <span><i className="snake-legend" /> ULAR</span>
            <span className="speed-label"><i /> KECEPATAN BERTAMBAH</span>
          </div>
        </div>

        <aside className="help-card">
          <div className="help-heading">
            <span className="help-icon">⌘</span>
            <div><h2>Kontrol permainan</h2><p>Gerakkan ular dengan lincah.</p></div>
          </div>
          <div className="key-controls" aria-label="Kontrol arah">
            <button aria-label="Atas" onClick={() => changeDirection(DIRECTIONS.ArrowUp)} type="button">↑</button>
            <div>
              <button aria-label="Kiri" onClick={() => changeDirection(DIRECTIONS.ArrowLeft)} type="button">←</button>
              <button aria-label="Bawah" onClick={() => changeDirection(DIRECTIONS.ArrowDown)} type="button">↓</button>
              <button aria-label="Kanan" onClick={() => changeDirection(DIRECTIONS.ArrowRight)} type="button">→</button>
            </div>
          </div>
          <div className="shortcut-row"><span>PAUSE / LANJUT</span><kbd>SPACE</kbd></div>
          <div className="shortcut-row"><span>KEYBOARD</span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></div>
        </aside>
      </section>

      <footer className="page-footer">
        <span>BUAT KAMU YANG KANGEN GAME KLASIK.</span>
        <button
          className="restart-button"
          onClick={() => {
            queuedDirection.current = null
            updateGame(createGame())
          }}
          type="button"
        >
          <span aria-hidden="true">↻</span> MULAI ULANG
        </button>
      </footer>
    </main>
  )
}

export default App
