import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import {
  ArrowDown,
  ArrowRight,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  Layers3,
  LoaderCircle,
  Search,
  SlidersHorizontal,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  SprayCan,
  X,
} from 'lucide-react'
import { api } from './api'
import { useShelf } from './useShelf'
import type { Fragrance, Match, SearchResponse, ShelfItem } from './types'

const BottleScene = lazy(() => import('./BottleScene'))
const initialQuery = 'Fresh citrus bergamot neroli'
const presets = [
  {
    name: 'Citrus & sky',
    query: 'Fresh citrus bergamot neroli',
    notes: ['Bergamot', 'Neroli', 'Musk'],
  },
  {
    name: 'Sunlit amber',
    query: 'Warm vanilla sandalwood amber',
    notes: ['Vanilla', 'Sandalwood', 'Amber'],
  },
  {
    name: 'After the rain',
    query: 'Woody vetiver cedar fresh without rose',
    notes: ['Vetiver', 'Cedar', 'Fresh woods'],
  },
]

function title(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase())
}
function errorMessage(error: unknown) {
  return error instanceof Error &&
    !['TypeError', 'TimeoutError'].includes(error.name)
    ? error.message
    : 'We couldn’t reach the scent library. Please try again in a moment.'
}

function FragranceCard({
  fragrance,
  preference,
  onSave,
  comparing,
  onCompare,
  comparisonFull,
}: {
  fragrance: Match
  preference?: ShelfItem['preference']
  onSave: (item: Fragrance, preference: ShelfItem['preference']) => void
  comparing: boolean
  onCompare: () => void
  comparisonFull: boolean
}) {
  return (
    <article className="fragrance-card">
      <div className="card-top">
        <span className="brand">{title(fragrance.brand)}</span>
        <button
          className="icon-button"
          aria-label={`${preference === 'saved' ? 'Unsave' : 'Save'} ${title(fragrance.name)}`}
          aria-pressed={preference === 'saved'}
          onClick={() => onSave(fragrance, 'saved')}
        >
          <Bookmark
            size={18}
            fill={preference === 'saved' ? 'currentColor' : 'none'}
          />
        </button>
      </div>
      <h3>{title(fragrance.name)}</h3>
      <p className="card-category">
        {fragrance.gender === 'men'
          ? 'Marketed for men'
          : fragrance.gender === 'women'
            ? 'Marketed for women'
            : 'Unisex'}
      </p>
      <div className="accords" aria-label="Main accords">
        {fragrance.accords.slice(0, 3).map((accord) => (
          <span key={accord}>{accord}</span>
        ))}
      </div>
      <p className="match-reason">
        <Sparkles size={14} aria-hidden="true" />
        <span>
          Shared character:{' '}
          {fragrance.matched_notes.join(', ') || 'your scent profile'}
        </span>
      </p>
      <details className="scent-details">
        <summary>Inside this scent</summary>
        <dl>
          {(['top', 'middle', 'base'] as const).map((layer) => (
            <div key={layer}>
              <dt>{layer === 'middle' ? 'Heart' : title(layer)}</dt>
              <dd>{fragrance.notes[layer].join(', ') || 'Not listed'}</dd>
            </div>
          ))}
        </dl>
        <p className="similarity">
          Scent similarity: {fragrance.similarity.toFixed(2)} / 1
        </p>
        <p>A comparison of scent profiles, not a probability you’ll like it.</p>
        <a href={fragrance.url} target="_blank" rel="noreferrer">
          View catalogue source
        </a>
      </details>
      <div className="card-actions">
        <button
          className="compare-button"
          aria-pressed={comparing}
          disabled={comparisonFull && !comparing}
          onClick={onCompare}
        >
          {comparing ? <Check size={15} /> : <Layers3 size={15} />}{' '}
          {comparing ? 'Comparing' : 'Compare'}
        </button>
        <div className="taste-actions">
          <button
            className="icon-button"
            aria-label={`Like ${title(fragrance.name)}`}
            aria-pressed={preference === 'liked'}
            onClick={() => onSave(fragrance, 'liked')}
          >
            <ThumbsUp size={16} />
          </button>
          <button
            className="icon-button"
            aria-label={`Dislike ${title(fragrance.name)}`}
            aria-pressed={preference === 'disliked'}
            onClick={() => onSave(fragrance, 'disliked')}
          >
            <ThumbsDown size={16} />
          </button>
        </div>
      </div>
    </article>
  )
}

export default function Discovery() {
  const [mode, setMode] = useState<'describe' | 'similar'>('describe')
  const [query, setQuery] = useState(initialQuery)
  const [source, setSource] = useState<Fragrance | null>(null)
  const [suggestions, setSuggestions] = useState<Fragrance[]>([])
  const [suggestionError, setSuggestionError] = useState('')
  const [suggesting, setSuggesting] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [avoid, setAvoid] = useState('')
  const [gender, setGender] = useState('all')
  const [diversity, setDiversity] = useState(0.15)
  const [personalize, setPersonalize] = useState(true)
  const [response, setResponse] = useState<SearchResponse | null>(null)
  const [resultLabel, setResultLabel] = useState(initialQuery)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [comparison, setComparison] = useState<Fragrance[]>([])
  const [rotation, setRotation] = useState(-0.32)
  const [mood, setMood] = useState(0)
  const [mistBurst, setMistBurst] = useState(0)
  const { shelf, save, remove, storageError } = useShelf()
  const request = useRef<AbortController | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const results = useRef<HTMLElement>(null)
  const tasteCount = shelf.filter((item) => item.preference !== 'saved').length
  const initialTaste = useRef({
    liked_ids: shelf
      .filter((item) => item.preference === 'liked')
      .map((item) => item.id),
    disliked_ids: shelf
      .filter((item) => item.preference === 'disliked')
      .map((item) => item.id),
  })

  useEffect(() => {
    const controller = new AbortController()
    request.current = controller
    api<SearchResponse>('/search', {
      method: 'POST',
      body: JSON.stringify({ query: initialQuery, ...initialTaste.current }),
      signal: controller.signal,
    })
      .then(setResponse)
      .catch((error) => {
        if (!controller.signal.aborted) setError(errorMessage(error))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => request.current?.abort()
  }, [])

  useEffect(() => {
    if (mode !== 'similar' || query.trim().length < 2 || source) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setSuggesting(true)
      setSuggestionError('')
      api<{ results: Fragrance[] }>(
        `/catalogue?q=${encodeURIComponent(query.trim())}`,
        { signal: controller.signal },
      )
        .then((data) => setSuggestions(data.results))
        .catch((error) => {
          if (!controller.signal.aborted)
            setSuggestionError(errorMessage(error))
        })
        .finally(() => {
          if (!controller.signal.aborted) setSuggesting(false)
        })
    }, 250)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [mode, query, source])

  async function search(event?: FormEvent, preset?: string) {
    event?.preventDefault()
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setError('')
    setResponse(null)
    setSuggestions([])
    const searchMode = preset ? 'describe' : mode
    const searchQuery = preset || query
    if (preset) {
      setQuery(preset)
      setMode('describe')
      setSource(null)
    }
    const preferences = {
      avoid_notes: avoid
        .split(',')
        .map((note) => note.trim())
        .filter(Boolean),
      gender,
      diversity,
      liked_ids: personalize
        ? shelf
            .filter((item) => item.preference === 'liked')
            .map((item) => item.id)
        : [],
      disliked_ids: personalize
        ? shelf
            .filter((item) => item.preference === 'disliked')
            .map((item) => item.id)
        : [],
    }
    try {
      const data = await api<SearchResponse>(
        searchMode === 'describe' ? '/search' : '/similar',
        {
          method: 'POST',
          signal: controller.signal,
          body: JSON.stringify({
            ...preferences,
            ...(searchMode === 'describe'
              ? { query: searchQuery }
              : source
                ? { cologne_id: source.id }
                : { cologne_name: searchQuery }),
          }),
        },
      )
      if (!controller.signal.aborted) {
        setResponse(data)
        setResultLabel(
          data.source
            ? `${title(data.source.brand)} ${title(data.source.name)}`
            : searchQuery || 'Your taste profile',
        )
        results.current?.focus({ preventScroll: true })
      }
    } catch (error) {
      if (!controller.signal.aborted) setError(errorMessage(error))
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  function changeMode(value: 'describe' | 'similar') {
    setMode(value)
    setQuery('')
    setSource(null)
    setSuggestions([])
    setSuggestionError('')
    setSuggesting(false)
    input.current?.focus()
  }
  function updateShelf(
    fragrance: Fragrance,
    preference: ShelfItem['preference'],
  ) {
    save(fragrance, preference)
    setNotice(
      preference === 'saved'
        ? 'Shelf updated. Your collection stays in this browser.'
        : 'Taste updated. Run your search again to use your latest preferences.',
    )
  }
  function toggleComparison(fragrance: Fragrance) {
    setComparison((current) =>
      current.some((item) => item.id === fragrance.id)
        ? current.filter((item) => item.id !== fragrance.id)
        : current.length < 3
          ? [...current, fragrance]
          : current,
    )
  }

  return (
    <div id="top" className="site-shell">
      <a className="skip-link" href="#discover">
        Skip to fragrance search
      </a>
      <header className="site-header">
        <a href="#top" className="wordmark" aria-label="Sillage home">
          Sillage
          <svg
            className="brand-mark"
            width="25"
            height="25"
            viewBox="0 0 25 25"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M4 5C18 1 8 12 21 7M3 12C17 8 7 19 20 14M2 19C16 15 6 26 19 21"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </a>
        <nav aria-label="Main navigation">
          <a className="nav-active" href="#discover">
            Discover
          </a>
          <a href="#shelf">
            Your shelf
            {shelf.length > 0 && (
              <span className="shelf-count">{shelf.length}</span>
            )}
          </a>
          <a className="nav-method" href="#approach">
            Our approach
          </a>
        </nav>
      </header>
      <main>
        <section className="hero-section" aria-labelledby="hero-title">
          <h1 id="hero-title">Something in the air.</h1>
          <div className="hero-moods">
            <fieldset>
              <legend>Find your mood</legend>
              {presets.map((preset, index) => (
                <button
                  key={preset.name}
                  type="button"
                  aria-pressed={mood === index}
                  onClick={() => {
                    setMood(index)
                    setMistBurst((value) => value + 1)
                    void search(undefined, preset.query)
                  }}
                >
                  <span>{preset.name}</span>
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              ))}
            </fieldset>
            <dl className="mood-notes">
              <div>
                <dt>Opens with</dt>
                <dd>{presets[mood].notes[0]}</dd>
              </div>
              <div>
                <dt>Settles into</dt>
                <dd>{presets[mood].notes[2]}</dd>
              </div>
            </dl>
          </div>
          <figure className="bottle-stage">
            <div className="mist-ground" aria-hidden="true" />
            <div className="bottle-canvas" aria-hidden="true">
              <Suspense
                fallback={
                  <div className="scene-fallback">A scent taking shape.</div>
                }
              >
                <BottleScene
                  rotation={rotation}
                  mood={mood}
                  burst={mistBurst}
                />
              </Suspense>
            </div>
            <div className="bottle-controls">
              <button
                type="button"
                className="icon-button"
                aria-label="Rotate bottle left"
                onClick={() => setRotation((value) => value - 0.6)}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                className="mist-button"
                onClick={() => setMistBurst((value) => value + 1)}
              >
                <SprayCan size={17} aria-hidden="true" />
                Release mist
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label="Rotate bottle right"
                onClick={() => setRotation((value) => value + 0.6)}
              >
                <ChevronRight size={18} />
              </button>
            </div>
            <figcaption>Drag to explore the bottle</figcaption>
          </figure>
          <div className="hero-copy">
            <p>
              Find fragrances that feel like you, before you buy the bottle.
            </p>
            <a
              className="primary-button"
              href="#discover"
              onClick={() => input.current?.focus({ preventScroll: true })}
            >
              Find my scent <ArrowRight size={18} aria-hidden="true" />
            </a>
            <span className="hero-footnote">
              Less guesswork.
              <br />
              More good chemistry.
            </span>
          </div>
          <a className="hero-scroll" href="#discover">
            Follow your senses <ArrowDown size={15} aria-hidden="true" />
          </a>
        </section>
        <section
          id="discover"
          className="discovery-section"
          aria-labelledby="discovery-title"
        >
          <div className="section-heading">
            <div>
              <h2 id="discovery-title">Your next scent starts here.</h2>
              <p>A note, a feeling, or a fragrance you already love.</p>
            </div>
            <span className="section-symbol" aria-hidden="true">
              <FlaskConical size={25} strokeWidth={1.25} />
            </span>
          </div>
          <div className="search-workbench">
            <div
              className="search-mode"
              role="group"
              aria-label="Search method"
            >
              <button
                aria-pressed={mode === 'describe'}
                onClick={() => changeMode('describe')}
              >
                <Sparkles size={16} /> Describe a scent
              </button>
              <button
                aria-pressed={mode === 'similar'}
                onClick={() => changeMode('similar')}
              >
                <Search size={16} /> Start with a fragrance
              </button>
            </div>
            <form onSubmit={(event) => void search(event)}>
              <label className="sr-only" htmlFor="scent-query">
                {mode === 'describe'
                  ? 'Describe your ideal scent'
                  : 'Fragrance name and brand'}
              </label>
              <div className="search-row">
                <Search size={21} className="search-icon" aria-hidden="true" />
                <input
                  ref={input}
                  id="scent-query"
                  value={query}
                  maxLength={mode === 'describe' ? 1000 : 100}
                  autoComplete="off"
                  placeholder={
                    mode === 'describe'
                      ? 'Something woody and warm, without rose…'
                      : 'Try Dior Sauvage or Terre d’Hermès…'
                  }
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setSource(null)
                    setSuggestions([])
                    setSuggestionError('')
                    setSuggesting(false)
                  }}
                />
                <button
                  type="submit"
                  className="primary-button"
                  disabled={
                    loading ||
                    (!query.trim() &&
                      !(mode === 'describe' && tasteCount > 0 && personalize))
                  }
                >
                  {loading ? (
                    <LoaderCircle size={18} className="spinner" />
                  ) : (
                    <ArrowRight size={18} />
                  )}
                  <span>
                    {loading ? 'Finding your scent' : 'Find my scent'}
                  </span>
                </button>
              </div>
              {mode === 'similar' && !source && query.trim().length >= 2 && (
                <div className="suggestions-region" aria-live="polite">
                  {suggesting && <p>Looking through the library…</p>}
                  {suggestionError && <p>{suggestionError}</p>}
                  {suggestions.length > 0 && (
                    <ul
                      className="suggestions"
                      aria-label="Choose a starting fragrance"
                    >
                      {suggestions.map((fragrance) => (
                        <li key={fragrance.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setSource(fragrance)
                              setQuery(
                                `${title(fragrance.brand)} ${title(fragrance.name)}`,
                              )
                              setSuggestions([])
                              setSuggesting(false)
                            }}
                          >
                            <span>{title(fragrance.name)}</span>
                            <span>{title(fragrance.brand)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {!suggesting &&
                    !suggestionError &&
                    suggestions.length === 0 && (
                      <p>
                        Enter a brand and fragrance name, then search for a
                        close match.
                      </p>
                    )}
                </div>
              )}
              {source && (
                <p className="source-selection">
                  <Check size={14} /> Starting from {title(source.brand)}{' '}
                  {title(source.name)}
                </p>
              )}
              <div className="search-options">
                <span>
                  Be specific about what you love. And what you don’t.
                </span>
                <button
                  type="button"
                  className="text-button"
                  aria-expanded={filtersOpen}
                  aria-controls="scent-filters"
                  onClick={() => setFiltersOpen((value) => !value)}
                >
                  <SlidersHorizontal size={15} /> Refine your search
                  {(avoid || gender !== 'all') && (
                    <span className="filter-active">Active</span>
                  )}
                </button>
              </div>
              <div id="scent-filters" className="filters" hidden={!filtersOpen}>
                <label>
                  Notes to avoid
                  <input
                    value={avoid}
                    maxLength={400}
                    placeholder="Rose, oud, vanilla"
                    onChange={(event) => setAvoid(event.target.value)}
                  />
                  <span>
                    Separate with commas. Excludes listed notes and accords.
                  </span>
                </label>
                <label>
                  Browse fragrances
                  <select
                    value={gender}
                    onChange={(event) => setGender(event.target.value)}
                  >
                    <option value="all">All fragrances</option>
                    <option value="men">Men’s & unisex</option>
                    <option value="women">Women’s & unisex</option>
                    <option value="unisex">Unisex</option>
                  </select>
                  <span>These are catalogue labels. Wear what you love.</span>
                </label>
                <label>
                  Discovery style
                  <select
                    value={diversity}
                    onChange={(event) =>
                      setDiversity(Number(event.target.value))
                    }
                  >
                    <option value={0}>Closest scent profiles</option>
                    <option value={0.15}>A little variety</option>
                    <option value={0.35}>More to explore</option>
                  </select>
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={personalize}
                    onChange={(event) => setPersonalize(event.target.checked)}
                  />{' '}
                  Use my likes & dislikes
                  <span>
                    Your shelf stays in this browser. Your taste is used when
                    you search.
                  </span>
                </label>
              </div>
            </form>
          </div>
        </section>
        <section
          ref={results}
          id="results"
          className="results-section"
          aria-labelledby="results-title"
          tabIndex={-1}
          aria-busy={loading}
        >
          <div className="section-heading">
            <div>
              <h2 id="results-title">
                {loading ? 'Finding your next discovery' : 'The scent edit'}
              </h2>
              <p>
                {response
                  ? `Inspired by ${resultLabel.toLowerCase()}`
                  : 'Thoughtfully matched to your scent profile.'}
              </p>
            </div>
            {response && (
              <span className="results-count">
                {response.results.length}{' '}
                {response.results.length === 1 ? 'discovery' : 'discoveries'}
              </span>
            )}
          </div>
          <div className="search-status" role="status" aria-live="polite">
            {notice}
            {storageError && <p>{storageError}</p>}
          </div>
          {loading && (
            <div className="loading-state">
              <LoaderCircle className="spinner" size={27} />
              <p>Looking for shared notes and new possibilities.</p>
            </div>
          )}
          {error && (
            <div className="empty-state" role="alert">
              <h3>The library is a little out of reach.</h3>
              <p>{error}</p>
              <button className="primary-button" onClick={() => void search()}>
                Try again
              </button>
            </div>
          )}
          {response && (
            <>
              {response.excluded_notes.length > 0 && (
                <div className="excluded-label" role="status">
                  Leaving out: {response.excluded_notes.join(', ')}
                </div>
              )}
              {response.results.length === 0 ? (
                <div className="empty-state">
                  <FlaskConical size={28} />
                  <h3>Let’s try another direction.</h3>
                  <p>{response.message}</p>
                  <button
                    className="text-button"
                    onClick={() => input.current?.focus()}
                  >
                    Edit your scent profile
                  </button>
                </div>
              ) : (
                <div className="fragrance-grid">
                  {response.results.map((fragrance) => (
                    <FragranceCard
                      key={fragrance.id}
                      fragrance={fragrance}
                      preference={
                        shelf.find((item) => item.id === fragrance.id)
                          ?.preference
                      }
                      onSave={updateShelf}
                      comparing={comparison.some(
                        (item) => item.id === fragrance.id,
                      )}
                      onCompare={() => toggleComparison(fragrance)}
                      comparisonFull={comparison.length >= 3}
                    />
                  ))}
                </div>
              )}
              <p className="sample-note">
                <FlaskConical size={16} /> A shortlist, not a certainty. Try a
                sample on your skin before a full bottle.
              </p>
            </>
          )}
        </section>
        {comparison.length > 0 && (
          <section
            id="compare"
            className="comparison-section"
            aria-labelledby="compare-title"
          >
            <div className="section-heading">
              <div>
                <h2 id="compare-title">Side by side</h2>
                <p>
                  Compare up to three scents. Look beyond the opening notes.
                </p>
              </div>
              <button className="text-button" onClick={() => setComparison([])}>
                Clear comparison <X size={15} />
              </button>
            </div>
            <div className="comparison-grid">
              {comparison.map((fragrance) => (
                <article key={fragrance.id}>
                  <div className="card-top">
                    <span>{title(fragrance.brand)}</span>
                    <button
                      className="icon-button"
                      aria-label={`Remove ${title(fragrance.name)} from comparison`}
                      onClick={() => toggleComparison(fragrance)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <h3>{title(fragrance.name)}</h3>
                  <dl>
                    {(['top', 'middle', 'base'] as const).map((layer) => (
                      <div key={layer}>
                        <dt>
                          {layer === 'middle' ? 'Heart' : title(layer)} notes
                        </dt>
                        <dd>
                          {fragrance.notes[layer].join(', ') || 'Not listed'}
                        </dd>
                      </div>
                    ))}
                    <div>
                      <dt>Main accords</dt>
                      <dd>{fragrance.accords.join(', ')}</dd>
                    </div>
                    <div>
                      <dt>Price & performance</dt>
                      <dd>
                        Not available in this catalogue. Check a current
                        retailer and try on skin.
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </section>
        )}
        <section
          id="shelf"
          className="shelf-section"
          aria-labelledby="shelf-title"
        >
          <div className="section-heading">
            <div>
              <h2 id="shelf-title">Keep a little collection.</h2>
              <p>
                Save a possibility. Like what you’ve tried. Skip what isn’t you.
              </p>
            </div>
            <Bookmark size={22} strokeWidth={1.25} aria-hidden="true" />
          </div>
          {shelf.length === 0 ? (
            <div className="shelf-empty">
              <Bookmark size={22} strokeWidth={1.25} />
              <p>A little space for your next signature.</p>
              <a href="#results" className="text-button">
                Explore your shortlist <ArrowDown size={15} />
              </a>
            </div>
          ) : (
            <>
              <ul className="shelf-list">
                {shelf.map((fragrance) => (
                  <li key={fragrance.id}>
                    <div>
                      <span>{title(fragrance.brand)}</span>
                      <h3>{title(fragrance.name)}</h3>
                    </div>
                    <span className="preference-label">
                      {fragrance.preference === 'saved'
                        ? 'Saved to try'
                        : fragrance.preference === 'liked'
                          ? 'Love this'
                          : 'Not for me'}
                    </span>
                    <div className="taste-actions">
                      <button
                        className="icon-button"
                        aria-label={`Like ${title(fragrance.name)} on shelf`}
                        aria-pressed={fragrance.preference === 'liked'}
                        onClick={() => updateShelf(fragrance, 'liked')}
                      >
                        <ThumbsUp size={16} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Dislike ${title(fragrance.name)} on shelf`}
                        aria-pressed={fragrance.preference === 'disliked'}
                        onClick={() => updateShelf(fragrance, 'disliked')}
                      >
                        <ThumbsDown size={16} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Remove ${title(fragrance.name)} from shelf`}
                        onClick={() => remove(fragrance.id)}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="privacy-note">
                Stored only in this browser, up to 50 scents. Clear any entry
                whenever you like.
              </p>
            </>
          )}
        </section>
        <section
          id="approach"
          className="approach-section"
          aria-labelledby="approach-title"
        >
          <h2 id="approach-title">Follow the notes. Trust your nose.</h2>
          <div>
            <p>
              We compare the character of fragrances: their accords, their
              opening, their heart, and what lingers. Shared notes bring a scent
              closer; your likes and dislikes make the search more personal.
            </p>
            <p>
              Scent is still personal. Our matches help you discover what to
              sample. They can’t predict skin chemistry, longevity, or how a
              fragrance will make you feel.
            </p>
            <details>
              <summary>A closer look at matching</summary>
              <p>
                Weighted TF-IDF vectors and cosine similarity compare scent
                profiles. A small diversity adjustment makes room for different
                discoveries. Similarity is a scent comparison, not a
                satisfaction score. The catalogue has no verified live prices or
                wear-time measurements.
              </p>
            </details>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <a className="wordmark" href="#top">
          Sillage
          <svg
            className="brand-mark"
            width="25"
            height="25"
            viewBox="0 0 25 25"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M4 5C18 1 8 12 21 7M3 12C17 8 7 19 20 14M2 19C16 15 6 26 19 21"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </a>
        <p>A little mystery looks good on you.</p>
        <a
          href="https://github.com/Blasted-ctrl/Sillage"
          target="_blank"
          rel="noreferrer"
        >
          About the project
        </a>
      </footer>
      {comparison.length > 0 && (
        <a className="compare-tray" href="#compare">
          <Layers3 size={18} />
          <span>
            Compare {comparison.length}{' '}
            {comparison.length === 1 ? 'scent' : 'scents'}
          </span>
          <ArrowDown size={16} />
        </a>
      )}
    </div>
  )
}
