import React, { useEffect, useMemo, useState } from 'react'

type Entry = {
  id: string
  createdAt: number
  tier: number
  wave: number
  date: string // YYYY-MM-DD for display/editing
  coins: number
  coinsPerHour: number
  durationSeconds: number
  cells: number
  dice: number
}

type DraftEntry = {
  tier: string
  wave: string
  date: string
  coins: string
  coinsPerHour: string
  duration: string // hh:mm:ss
  cells: string
  dice: string
  durationMode: 'auto' | 'manual'
}

type EditingDraft = {
  tier: string
  wave: string
  date: string
  coins: string
  coinsPerHour: string
  duration: string
  cells: string
  dice: string
  durationMode: 'auto' | 'manual'
}

const STORAGE_KEY: string = 'resource-rate-tracker-entries'

function formatDateForInput(date: Date): string {
  const year: number = date.getFullYear()
  const month: string = String(date.getMonth() + 1).padStart(2, '0')
  const day: string = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return '—'
  }

  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

function formatDuration(totalSeconds: number): string {
  const safeSeconds: number = Math.max(0, Math.floor(totalSeconds))
  const hours: number = Math.floor(safeSeconds / 3600)
  const minutes: number = Math.floor((safeSeconds % 3600) / 60)
  const seconds: number = safeSeconds % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function parseDurationToSeconds(value: string): number | null {
  const trimmed: string = value.trim()
  const match: RegExpMatchArray | null = trimmed.match(/^(\d{1,3}):(\d{2}):(\d{2})$/)

  if (!match) {
    return null
  }

  const hours: number = Number(match[1])
  const minutes: number = Number(match[2])
  const seconds: number = Number(match[3])

  if (minutes > 59 || seconds > 59) {
    return null
  }

  return hours * 3600 + minutes * 60 + seconds
}

function secondsToHours(totalSeconds: number): number {
  return totalSeconds / 3600
}

function calculateAutoDurationSeconds(coins: number, coinsPerHour: number): number | null {
  if (coins <= 0 || coinsPerHour <= 0) {
    return null
  }

  return Math.round((coins / coinsPerHour) * 3600)
}

function calculatePerHour(total: number, durationSeconds: number): number | null {
  if (total < 0 || durationSeconds <= 0) {
    return null
  }

  return total / secondsToHours(durationSeconds)
}

function getHeatColor(value: number | null, min: number, max: number): string {
  if (value === null || !Number.isFinite(value)) {
    return 'transparent'
  }

  if (min === max) {
    return 'hsl(60 90% 78%)'
  }

  const ratio: number = (value - min) / (max - min)
  const hue: number = ratio * 120
  return `hsl(${hue} 85% 78%)`
}

function buildDefaultDraft(): DraftEntry {
  return {
    tier: '',
    wave: '',
    date: formatDateForInput(new Date()),
    coins: '',
    coinsPerHour: '',
    duration: '',
    cells: '',
    dice: '',
    durationMode: 'auto',
  }
}

function readStoredEntries(): Entry[] {
  try {
    const raw: string | null = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return []
    }

    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .map((item: unknown): Entry | null => {
        if (!item || typeof item !== 'object') {
          return null
        }

        const maybe: Partial<Entry> = item as Partial<Entry>

        if (
          typeof maybe.id !== 'string' ||
          typeof maybe.createdAt !== 'number' ||
          typeof maybe.tier !== 'number' ||
          typeof maybe.wave !== 'number' ||
          typeof maybe.date !== 'string' ||
          typeof maybe.coins !== 'number' ||
          typeof maybe.coinsPerHour !== 'number' ||
          typeof maybe.durationSeconds !== 'number' ||
          typeof maybe.cells !== 'number' ||
          typeof maybe.dice !== 'number'
        ) {
          return null
        }

        return {
          id: maybe.id,
          createdAt: maybe.createdAt,
          tier: maybe.tier,
          wave: maybe.wave,
          date: maybe.date,
          coins: maybe.coins,
          coinsPerHour: maybe.coinsPerHour,
          durationSeconds: maybe.durationSeconds,
          cells: maybe.cells,
          dice: maybe.dice,
        }
      })
      .filter((entry: Entry | null): entry is Entry => entry !== null)
      .sort((a: Entry, b: Entry) => b.createdAt - a.createdAt)
  } catch {
    return []
  }
}

function toEditingDraft(entry: Entry): EditingDraft {
  return {
    tier: String(entry.tier),
    wave: String(entry.wave),
    date: entry.date,
    coins: String(entry.coins),
    coinsPerHour: String(entry.coinsPerHour),
    duration: formatDuration(entry.durationSeconds),
    cells: String(entry.cells),
    dice: String(entry.dice),
    durationMode: 'manual',
  }
}

export default function ResourceRateTrackerApp(): React.ReactElement {
  const [entries, setEntries] = useState<Entry[]>((): Entry[] => readStoredEntries())
  const [draft, setDraft] = useState<DraftEntry>(buildDefaultDraft())
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingDraft, setEditingDraft] = useState<EditingDraft | null>(null)


  useEffect((): void => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  }, [entries])

  const perHourExtremes = useMemo((): {
    coins: { min: number; max: number }
    cells: { min: number; max: number }
    dice: { min: number; max: number }
  } => {
    const coinRates: number[] = entries
      .map((entry: Entry): number => entry.coinsPerHour)
      .filter((value: number): boolean => Number.isFinite(value))

    const cellRates: number[] = entries
      .map((entry: Entry): number | null => calculatePerHour(entry.cells, entry.durationSeconds))
      .filter((value: number | null): value is number => value !== null)

    const diceRates: number[] = entries
      .map((entry: Entry): number | null => calculatePerHour(entry.dice, entry.durationSeconds))
      .filter((value: number | null): value is number => value !== null)

    return {
      coins: {
        min: coinRates.length ? Math.min(...coinRates) : 0,
        max: coinRates.length ? Math.max(...coinRates) : 0,
      },
      cells: {
        min: cellRates.length ? Math.min(...cellRates) : 0,
        max: cellRates.length ? Math.max(...cellRates) : 0,
      },
      dice: {
        min: diceRates.length ? Math.min(...diceRates) : 0,
        max: diceRates.length ? Math.max(...diceRates) : 0,
      },
    }
  }, [entries])

  const resolvedDraftDurationSeconds = useMemo((): number | null => {
    const coins: number = Number(draft.coins)
    const coinsPerHour: number = Number(draft.coinsPerHour)

    if (draft.durationMode === 'auto') {
      return calculateAutoDurationSeconds(coins, coinsPerHour)
    }

    return parseDurationToSeconds(draft.duration)
  }, [draft])

  const draftCellsPerHour = useMemo((): number | null => {
    if (resolvedDraftDurationSeconds === null) {
      return null
    }

    return calculatePerHour(Number(draft.cells), resolvedDraftDurationSeconds)
  }, [draft.cells, resolvedDraftDurationSeconds])

  const draftDicePerHour = useMemo((): number | null => {
    if (resolvedDraftDurationSeconds === null) {
      return null
    }

    return calculatePerHour(Number(draft.dice), resolvedDraftDurationSeconds)
  }, [draft.dice, resolvedDraftDurationSeconds])

  function updateDraft<K extends keyof DraftEntry>(key: K, value: DraftEntry[K]): void {
    setDraft((current: DraftEntry): DraftEntry => ({
      ...current,
      [key]: value,
    }))
  }

  function validateDraft(currentDraft: DraftEntry): { isValid: boolean; message: string; normalized?: Entry } {
    const tier: number = Number(currentDraft.tier)
    const wave: number = Number(currentDraft.wave)
    const coins: number = Number(currentDraft.coins)
    const coinsPerHour: number = Number(currentDraft.coinsPerHour)
    const cells: number = Number(currentDraft.cells)
    const dice: number = Number(currentDraft.dice)

    if (!Number.isInteger(tier) || tier < 1 || tier > 21) {
      return { isValid: false, message: 'Tier must be a whole number from 1 to 21.' }
    }

    if (!Number.isFinite(wave) || wave < 0) {
      return { isValid: false, message: 'Wave must be a valid number.' }
    }

    if (!currentDraft.date) {
      return { isValid: false, message: 'Date is required.' }
    }

    if (!Number.isFinite(coins) || coins < 0) {
      return { isValid: false, message: 'Coins must be a valid number.' }
    }

    if (!Number.isFinite(coinsPerHour) || coinsPerHour <= 0) {
      return { isValid: false, message: 'Coins Per Hour must be greater than 0.' }
    }

    if (!Number.isFinite(cells) || cells < 0) {
      return { isValid: false, message: 'Cells must be a valid number.' }
    }

    if (!Number.isFinite(dice) || dice < 0) {
      return { isValid: false, message: 'Dice must be a valid number.' }
    }

    let durationSeconds: number | null = null

    if (currentDraft.durationMode === 'auto') {
      durationSeconds = calculateAutoDurationSeconds(coins, coinsPerHour)
      if (durationSeconds === null) {
        return {
          isValid: false,
          message: 'Duration could not be calculated. Check Coins and Coins Per Hour.',
        }
      }
    } else {
      durationSeconds = parseDurationToSeconds(currentDraft.duration)
      if (durationSeconds === null || durationSeconds <= 0) {
        return {
          isValid: false,
          message: 'Manual Duration must be in hh:mm:ss format and greater than 00:00:00.',
        }
      }
    }

    return {
      isValid: true,
      message: '',
      normalized: {
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        tier,
        wave,
        date: currentDraft.date,
        coins,
        coinsPerHour,
        durationSeconds,
        cells,
        dice,
      },
    }
  }

  function handleSave(): void {
    const result = validateDraft(draft)

    if (!result.isValid || !result.normalized) {
      setErrorMessage(result.message)
      return
    }

    setEntries((current: Entry[]): Entry[] => [result.normalized!, ...current].sort((a: Entry, b: Entry) => b.createdAt - a.createdAt))
    setDraft(buildDefaultDraft())
    setErrorMessage('')
  }

  function startEditing(entry: Entry): void {
    setEditingId(entry.id)
    setEditingDraft(toEditingDraft(entry))
  }

  function cancelEditing(): void {
    setEditingId(null)
    setEditingDraft(null)
  }

  function updateEditingDraft<K extends keyof EditingDraft>(key: K, value: EditingDraft[K]): void {
    setEditingDraft((current: EditingDraft | null): EditingDraft | null => {
      if (!current) {
        return current
      }

      return {
        ...current,
        [key]: value,
      }
    })
  }

  function saveEditedRow(entryId: string): void {
    if (!editingDraft) {
      return
    }

    const tier: number = Number(editingDraft.tier)
    const wave: number = Number(editingDraft.wave)
    const coins: number = Number(editingDraft.coins)
    const coinsPerHour: number = Number(editingDraft.coinsPerHour)
    const cells: number = Number(editingDraft.cells)
    const dice: number = Number(editingDraft.dice)
    const durationSeconds: number | null = parseDurationToSeconds(editingDraft.duration)

    if (!Number.isInteger(tier) || tier < 1 || tier > 21) {
      window.alert('Tier must be a whole number from 1 to 21.')
      return
    }

    if (!Number.isFinite(wave) || wave < 0) {
      window.alert('Wave must be a valid number.')
      return
    }

    if (!editingDraft.date) {
      window.alert('Date is required.')
      return
    }

    if (!Number.isFinite(coins) || coins < 0) {
      window.alert('Coins must be a valid number.')
      return
    }

    if (!Number.isFinite(coinsPerHour) || coinsPerHour <= 0) {
      window.alert('Coins Per Hour must be greater than 0.')
      return
    }

    if (durationSeconds === null || durationSeconds <= 0) {
      window.alert('Duration must be in hh:mm:ss format and greater than 00:00:00.')
      return
    }

    if (!Number.isFinite(cells) || cells < 0) {
      window.alert('Cells must be a valid number.')
      return
    }

    if (!Number.isFinite(dice) || dice < 0) {
      window.alert('Dice must be a valid number.')
      return
    }

    setEntries((current: Entry[]): Entry[] =>
      current
        .map((entry: Entry): Entry => {
          if (entry.id !== entryId) {
            return entry
          }

          return {
            ...entry,
            tier,
            wave,
            date: editingDraft.date,
            coins,
            coinsPerHour,
            durationSeconds,
            cells,
            dice,
          }
        })
        .sort((a: Entry, b: Entry) => b.createdAt - a.createdAt)
    )

    cancelEditing()
  }

  function deleteEntry(entryId: string): void {
    setEntries((current: Entry[]): Entry[] => current.filter((entry: Entry): boolean => entry.id !== entryId))
    if (editingId === entryId) {
      cancelEditing()
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6">
          <h1 className="text-2xl font-semibold tracking-tight">Resource Rate Tracker</h1>
          <p className="text-sm text-slate-600 mt-2">
            Save runs locally in your browser. Duration can be auto-calculated from Coins and Coins Per Hour or manually entered in hh:mm:ss.
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">New Entry</h2>
            <div className="inline-flex rounded-2xl bg-slate-100 p-1">
              <button
                type="button"
                className={`px-4 py-2 rounded-2xl text-sm font-medium transition ${draft.durationMode === 'auto' ? 'bg-white shadow text-slate-900' : 'text-slate-600'}`}
                onClick={(): void => updateDraft('durationMode', 'auto')}
              >
                Auto Duration
              </button>
              <button
                type="button"
                className={`px-4 py-2 rounded-2xl text-sm font-medium transition ${draft.durationMode === 'manual' ? 'bg-white shadow text-slate-900' : 'text-slate-600'}`}
                onClick={(): void => updateDraft('durationMode', 'manual')}
              >
                Manual Duration
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <label className="space-y-1">
              <span className="text-sm font-medium">Date</span>
              <input
                type="date"
                value={draft.date}
                onChange={(event: React.ChangeEvent<HTMLInputElement>): void => updateDraft('date', event.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium">Tier</span>
              <input
                type="number"
                min={1}
                max={21}
                value={draft.tier}
                onChange={(event: React.ChangeEvent<HTMLInputElement>): void => updateDraft('tier', event.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium">Wave</span>
              <input
                type="number"
                min={0}
                step="1"
                value={draft.wave}
                onChange={(event: React.ChangeEvent<HTMLInputElement>): void => updateDraft('wave', event.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium">Coins</span>
              <input
                type="number"
                min={0}
                step="any"
                value={draft.coins}
                onChange={(event: React.ChangeEvent<HTMLInputElement>): void => updateDraft('coins', event.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium">Coins Per Hour</span>
              <input
                type="number"
                min={0}
                step="any"
                value={draft.coinsPerHour}
                onChange={(event: React.ChangeEvent<HTMLInputElement>): void => updateDraft('coinsPerHour', event.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium">Duration</span>
              {draft.durationMode === 'manual' ? (
                <input
                  type="text"
                  placeholder="hh:mm:ss"
                  value={draft.duration}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>): void => updateDraft('duration', event.target.value)}
                  className="w-full rounded-2xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
                />
              ) : (
                <input
                  type="text"
                  readOnly={true}
                  value={resolvedDraftDurationSeconds !== null ? formatDuration(resolvedDraftDurationSeconds) : ''}
                  placeholder="Auto-calculated"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600"
                />
              )}
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium">Cells</span>
              <input
                type="number"
                min={0}
                step="any"
                value={draft.cells}
                onChange={(event: React.ChangeEvent<HTMLInputElement>): void => updateDraft('cells', event.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium">Cells Per Hour</span>
              <input
                type="text"
                readOnly={true}
                value={draftCellsPerHour !== null ? formatNumber(draftCellsPerHour) : ''}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium">Dice</span>
              <input
                type="number"
                min={0}
                step="any"
                value={draft.dice}
                onChange={(event: React.ChangeEvent<HTMLInputElement>): void => updateDraft('dice', event.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-end">
            <label className="space-y-1 max-w-sm">
              <span className="text-sm font-medium">Dice Per Hour</span>
              <input
                type="text"
                readOnly={true}
                value={draftDicePerHour !== null ? formatNumber(draftDicePerHour) : ''}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600"
              />
            </label>

            <button
              type="button"
              onClick={handleSave}
              className="h-11 px-5 rounded-2xl bg-slate-900 text-white font-medium hover:bg-slate-800 transition"
            >
              Save Entry
            </button>
          </div>

          {errorMessage ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Saved Entries</h2>
            <div className="text-sm text-slate-500">Sorted newest to oldest</div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Date</th>
                  <th className="px-4 py-3 text-left font-semibold">Tier</th>
                  <th className="px-4 py-3 text-left font-semibold">Wave</th>
                  <th className="px-4 py-3 text-left font-semibold">Coins</th>
                  <th className="px-4 py-3 text-left font-semibold">Coins / Hr</th>
                  <th className="px-4 py-3 text-left font-semibold">Duration</th>
                  <th className="px-4 py-3 text-left font-semibold">Cells</th>
                  <th className="px-4 py-3 text-left font-semibold">Cells / Hr</th>
                  <th className="px-4 py-3 text-left font-semibold">Dice</th>
                  <th className="px-4 py-3 text-left font-semibold">Dice / Hr</th>
                  <th className="px-4 py-3 text-left font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-slate-500">
                      No entries yet.
                    </td>
                  </tr>
                ) : (
                  entries.map((entry: Entry): React.ReactElement => {
                    const cellsPerHour: number | null = calculatePerHour(entry.cells, entry.durationSeconds)
                    const dicePerHour: number | null = calculatePerHour(entry.dice, entry.durationSeconds)
                    const isEditing: boolean = editingId === entry.id && editingDraft !== null

                    return (
                      <tr key={entry.id} className="border-t border-slate-200 align-top">
                        {isEditing && editingDraft ? (
                          <>
                            <td className="px-4 py-3">
                              <input
                                type="date"
                                value={editingDraft.date}
                                onChange={(event: React.ChangeEvent<HTMLInputElement>): void => updateEditingDraft('date', event.target.value)}
                                className="rounded-xl border border-slate-300 px-2 py-1.5"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                min={1}
                                max={21}
                                value={editingDraft.tier}
                                onChange={(event: React.ChangeEvent<HTMLInputElement>): void => updateEditingDraft('tier', event.target.value)}
                                className="w-20 rounded-xl border border-slate-300 px-2 py-1.5"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                min={0}
                                step="1"
                                value={editingDraft.wave}
                                onChange={(event: React.ChangeEvent<HTMLInputElement>): void => updateEditingDraft('wave', event.target.value)}
                                className="w-20 rounded-xl border border-slate-300 px-2 py-1.5"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                min={0}
                                step="any"
                                value={editingDraft.coins}
                                onChange={(event: React.ChangeEvent<HTMLInputElement>): void => updateEditingDraft('coins', event.target.value)}
                                className="w-28 rounded-xl border border-slate-300 px-2 py-1.5"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                min={0}
                                step="any"
                                value={editingDraft.coinsPerHour}
                                onChange={(event: React.ChangeEvent<HTMLInputElement>): void => updateEditingDraft('coinsPerHour', event.target.value)}
                                className="w-28 rounded-xl border border-slate-300 px-2 py-1.5"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                placeholder="hh:mm:ss"
                                value={editingDraft.duration}
                                onChange={(event: React.ChangeEvent<HTMLInputElement>): void => updateEditingDraft('duration', event.target.value)}
                                className="w-28 rounded-xl border border-slate-300 px-2 py-1.5"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                min={0}
                                step="any"
                                value={editingDraft.cells}
                                onChange={(event: React.ChangeEvent<HTMLInputElement>): void => updateEditingDraft('cells', event.target.value)}
                                className="w-24 rounded-xl border border-slate-300 px-2 py-1.5"
                              />
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {((): string => {
                                const seconds: number | null = parseDurationToSeconds(editingDraft.duration)
                                const value: number | null = seconds !== null ? calculatePerHour(Number(editingDraft.cells), seconds) : null
                                return value !== null ? formatNumber(value) : '—'
                              })()}
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                min={0}
                                step="any"
                                value={editingDraft.dice}
                                onChange={(event: React.ChangeEvent<HTMLInputElement>): void => updateEditingDraft('dice', event.target.value)}
                                className="w-24 rounded-xl border border-slate-300 px-2 py-1.5"
                              />
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {((): string => {
                                const seconds: number | null = parseDurationToSeconds(editingDraft.duration)
                                const value: number | null = seconds !== null ? calculatePerHour(Number(editingDraft.dice), seconds) : null
                                return value !== null ? formatNumber(value) : '—'
                              })()}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={(): void => saveEditedRow(entry.id)}
                                  className="px-3 py-1.5 rounded-xl bg-slate-900 text-white"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelEditing}
                                  className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white"
                                >
                                  Cancel
                                </button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-3">{entry.date}</td>
                            <td className="px-4 py-3">{entry.tier}</td>
                            <td className="px-4 py-3">{entry.wave}</td>
                            <td className="px-4 py-3">{formatNumber(entry.coins)}</td>
                            <td
                              className="px-4 py-3"
                              style={{
                                backgroundColor: getHeatColor(
                                  entry.coinsPerHour,
                                  perHourExtremes.coins.min,
                                  perHourExtremes.coins.max
                                ),
                              }}
                            >
                              {formatNumber(entry.coinsPerHour)}
                            </td>
                            <td className="px-4 py-3">{formatDuration(entry.durationSeconds)}</td>
                            <td className="px-4 py-3">{formatNumber(entry.cells)}</td>
                            <td
                              className="px-4 py-3"
                              style={{
                                backgroundColor: getHeatColor(
                                  cellsPerHour,
                                  perHourExtremes.cells.min,
                                  perHourExtremes.cells.max
                                ),
                              }}
                            >
                              {cellsPerHour !== null ? formatNumber(cellsPerHour) : '—'}
                            </td>
                            <td className="px-4 py-3">{formatNumber(entry.dice)}</td>
                            <td
                              className="px-4 py-3"
                              style={{
                                backgroundColor: getHeatColor(
                                  dicePerHour,
                                  perHourExtremes.dice.min,
                                  perHourExtremes.dice.max
                                ),
                              }}
                            >
                              {dicePerHour !== null ? formatNumber(dicePerHour) : '—'}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={(): void => startEditing(entry)}
                                  className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={(): void => deleteEntry(entry.id)}
                                  className="px-3 py-1.5 rounded-xl border border-red-200 bg-red-50 text-red-700"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
