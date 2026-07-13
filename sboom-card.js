/**
 * SBoom Card — компактная Lovelace-карточка плеера SberBoom.
 *
 * НЕ дублирует код: наследует data-feed из `SboomFeedBase` и переиспользует
 * Lit-компоненты панели, импортируя их по URL, который РАЗДАЁТ САМА интеграция
 * `sboom_ha` (`/sboom_panel/...`, cache_headers=False). Один общий `lit-base`
 * → консистентный Lit-runtime между панелью и карточкой. Требует установленной
 * интеграции sboom_ha (иначе нет ни WS-API, ни этих модулей).
 *
 * Визуально — мини-клон immersive-панели: обложка во весь фон карточки (.art),
 * верхняя вуаль, фрост-стекло снизу (.glass) с now-playing + транспортом,
 * ambient-glow из цвета обложки; browse — раскрываемый фрост-блок под картой.
 *
 * Конфиг карточки:
 *   type: custom:sboom-card
 *   entry_id: <config_entry колонки>   # какую колонку показывать (мультирум)
 *   mode: compact | full               # full = сразу с browse
 *   show_browse: true|false            # раскрыть drill-down поиск/очередь
 */

// Побочные импорты — регистрируют custom-элементы панели (те же файлы, что
// грузит сама панель). Абсолютный путь резолвится к статике интеграции.
import "/sboom_panel/components/sboom-toast.js";
import "/sboom_panel/components/sboom-nowplaying.js";
import "/sboom_panel/components/sboom-controls.js";
import "/sboom_panel/components/sboom-track-row.js";
import "/sboom_panel/components/sboom-tile.js";
import "/sboom_panel/components/sboom-browse.js";

import { LitElement, html, css, nothing } from "/sboom_panel/lit-base.js";
import { SboomFeedBase } from "/sboom_panel/components/sboom-feed-base.js";
import { tokens } from "/sboom_panel/components/sboom-tokens.css.js";

const DEFAULT_GLOW = "#7C5CFF";
const CARD_VERSION = "0.1.0";

/* ────────────────────────────────────────────────────────────────────────
 * GUI-редактор конфигурации карточки (инлайн в тот же модуль — HACS ставит
 * один файл `filename`, отдельный редактор-файл не доедет). Эмитит
 * стандартное `config-changed`.
 * ──────────────────────────────────────────────────────────────────────── */
class SboomCardEditor extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      _config: { type: Object },
      _devices: { type: Array },
    };
  }

  constructor() {
    super();
    this._config = {};
    this._devices = [];
    this._devicesLoaded = false;
  }

  setConfig(config) {
    this._config = { ...config };
  }

  updated(changed) {
    if (changed.has("hass") && this.hass && !this._devicesLoaded) {
      this._devicesLoaded = true;
      this.hass
        .callWS({ type: "sboom/devices" })
        .then((res) => {
          this._devices = res?.devices || [];
        })
        .catch(() => {
          this._devices = [];
        });
    }
  }

  _emit(patch) {
    this._config = { ...this._config, ...patch };
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: this._config },
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    const c = this._config || {};
    return html`
      <div class="form">
        <label class="field">
          <span class="lbl">Колонка</span>
          <select
            @change=${(e) =>
              this._emit({ entry_id: e.target.value || undefined })}
          >
            <option value="" ?selected=${!c.entry_id}>
              — первая доступная —
            </option>
            ${this._devices.map(
              (d) =>
                html`<option
                  value=${d.entry_id}
                  ?selected=${c.entry_id === d.entry_id}
                >
                  ${d.name}
                </option>`,
            )}
          </select>
        </label>

        <label class="field">
          <span class="lbl">Режим</span>
          <select @change=${(e) => this._emit({ mode: e.target.value })}>
            <option
              value="compact"
              ?selected=${(c.mode || "compact") === "compact"}
            >
              Компактный
            </option>
            <option value="full" ?selected=${c.mode === "full"}>
              Полный (с каталогом)
            </option>
          </select>
        </label>

        <label class="field row">
          <input
            type="checkbox"
            .checked=${c.show_browse ?? c.mode === "full"}
            @change=${(e) => this._emit({ show_browse: e.target.checked })}
          />
          <span class="lbl">Раскрыть каталог (поиск/очередь)</span>
        </label>

        <p class="hint">
          Карточке нужна установленная интеграция <b>sboom_ha</b> (WS-API +
          общие компоненты). Если колонок несколько — задайте нужную здесь.
        </p>
      </div>
    `;
  }

  static get styles() {
    return [
      tokens,
      css`
        .form {
          display: flex;
          flex-direction: column;
          gap: 14px;
          color: var(--sb-ink);
          font-family: system-ui, "Segoe UI", Roboto, sans-serif;
          padding: 4px 2px;
        }
        .field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .field.row {
          flex-direction: row;
          align-items: center;
          gap: 10px;
        }
        .lbl {
          font-size: 13px;
          color: var(--sb-ink-dim);
        }
        select {
          appearance: none;
          background: var(--sb-elev);
          color: var(--sb-ink);
          border: 1px solid var(--sb-line);
          border-radius: var(--sb-radius-sm);
          font: inherit;
          font-size: 14px;
          padding: 9px 12px;
          cursor: pointer;
        }
        input[type="checkbox"] {
          width: 18px;
          height: 18px;
          accent-color: var(--sb-accent);
        }
        .hint {
          margin: 4px 0 0;
          font-size: 12px;
          color: var(--sb-ink-faint);
          line-height: 1.5;
        }
      `,
    ];
  }
}

customElements.define("sboom-card-editor", SboomCardEditor);

class SboomCard extends SboomFeedBase {
  static get properties() {
    return {
      _glow: { type: String },
      _picker: { type: Boolean },
      _browseOpen: { type: Boolean },
      _idle: { type: Boolean },
    };
  }

  constructor() {
    super();
    this._glow = DEFAULT_GLOW;
    this._lastCover = null;
    this._picker = false;
    this._mode = "compact";
    this._showBrowse = false;
    this._browseOpen = false;
    this._idle = false; // после простоя транспорт+громкость сворачиваются
    this._idleTimer = null;
    this._wake = this._wake.bind(this);
  }

  connectedCallback() {
    super.connectedCallback(); // поднимает feed (SboomFeedBase)
    this._wake();
  }

  disconnectedCallback() {
    super.disconnectedCallback(); // гасит feed
    clearTimeout(this._idleTimer);
  }

  // как в панели: активность мыши/касания «будит», через 10с простоя —
  // сворачиваем контролы+громкость, оставляя метаданные+скраббер (обложка
  // видна лучше). Reflow-free: .stage держит высоту (aspect-ratio/min-height).
  _wake() {
    if (this._idle) this._idle = false;
    clearTimeout(this._idleTimer);
    this._idleTimer = setTimeout(() => {
      this._idle = true;
    }, 10000);
  }

  // ── Lovelace card API ──────────────────────────────────────────────────
  setConfig(config) {
    if (!config || typeof config !== "object") {
      throw new Error("sboom-card: некорректная конфигурация");
    }
    this._mode = config.mode === "full" ? "full" : "compact";
    this._showBrowse =
      config.show_browse !== undefined
        ? !!config.show_browse
        : this._mode === "full";
    this._browseOpen = this._showBrowse;
    const newEntry = config.entry_id || null;
    if (newEntry !== this._entryId) {
      this._entryId = newEntry;
      // если feed уже поднят с другой колонкой — переподписаться на новую
      if (this.hass) {
        this._teardownFeed();
        this._devicesLoaded = false;
        this._state = null;
        this._ensureFeed();
      }
    }
  }

  getCardSize() {
    // immersive-карта ~min360/max560px ≈ 8 юнитов; browse-панель до 62vh ≈ +6
    return this._browseOpen ? 14 : 8;
  }

  static getConfigElement() {
    return document.createElement("sboom-card-editor");
  }

  static async getStubConfig(hass) {
    try {
      const res = await hass.callWS({ type: "sboom/devices" });
      const first = res?.devices?.[0]?.entry_id;
      return {
        type: "custom:sboom-card",
        ...(first ? { entry_id: first } : {}),
        mode: "compact",
      };
    } catch {
      return { type: "custom:sboom-card", mode: "compact" };
    }
  }

  // ── presentation-хуки базы ─────────────────────────────────────────────
  _onStateApplied(state) {
    this._syncGlow(state?.track?.cover_url || null);
  }

  _onDeviceSelected(_entryId) {
    this._glow = DEFAULT_GLOW;
    this._lastCover = null;
  }

  async _syncGlow(coverUrl) {
    if (coverUrl === this._lastCover) return;
    this._lastCover = coverUrl;
    if (!coverUrl) {
      this._glow = DEFAULT_GLOW;
      return;
    }
    const color = await this.fetchCoverColor(coverUrl);
    if (coverUrl === this._lastCover) this._glow = color || DEFAULT_GLOW;
  }

  _togglePicker(e) {
    e?.stopPropagation();
    this._picker = !this._picker;
    if (this._picker) {
      const close = () => {
        this._picker = false;
        window.removeEventListener("click", close);
      };
      setTimeout(() => window.addEventListener("click", close), 0);
    }
  }

  _selectDevice(entryId) {
    this._picker = false;
    super._selectDevice(entryId);
  }

  get _deviceName() {
    const d = this._devices.find((x) => x.entry_id === this._entryId);
    return d?.name || "SberBoom";
  }

  _toggleBrowse() {
    this._browseOpen = !this._browseOpen;
    // сообщить лейауту, что размер карточки изменился
    this.dispatchEvent(
      new CustomEvent("iron-resize", { bubbles: true, composed: true }),
    );
  }

  static get styles() {
    return [
      tokens,
      css`
        :host {
          display: block;
        }
        * {
          box-sizing: border-box;
        }

        /* ── .root: несёт ambient-glow (inline --sb-glow) + объединяет карту, browse, toast ── */
        .root {
          display: block;
          transition: --sb-glow 0.6s ease;
        }

        /* ── .stage = .player панели: обложка-фон + вуаль + фрост-стекло снизу ── */
        .stage {
          position: relative;
          display: flex;
          flex-direction: column;
          border-radius: var(--sb-radius);
          overflow: hidden;
          isolation: isolate; /* свой stacking-context для z-index слоёв */
          /* компактная адаптивная высота: не жёсткий квадрат — обложка проступает над стеклом */
          aspect-ratio: 5 / 6;
          min-height: 360px;
          max-height: 560px;
          color: #fff;
          font-family: system-ui, "Segoe UI", Roboto, sans-serif;
          background:
            radial-gradient(
              120% 90% at 30% 12%,
              var(--sb-glow-soft),
              transparent 60%
            ),
            var(--sb-elev);
          box-shadow:
            0 26px 64px -24px rgba(0, 0, 0, 0.65),
            inset 0 0 0 1px rgba(255, 255, 255, 0.06);
        }

        /* ── .art (z0): обложка cover / фолбэк-градиент glow-soft+elev ── */
        .art {
          position: absolute;
          inset: 0;
          z-index: 0;
          background:
            radial-gradient(
              120% 90% at 30% 12%,
              var(--sb-glow-soft),
              transparent 60%
            ),
            var(--sb-elev);
        }
        .art img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        /* ── .veil (z1): верхняя вуаль под .head, чтобы белый текст читался поверх любой обложки ── */
        .veil {
          position: absolute;
          inset: 0;
          z-index: 1;
          pointer-events: none;
          background: linear-gradient(
            to bottom,
            rgba(6, 6, 10, 0.5),
            transparent 24%
          );
        }

        /* ── .head (z3): picker/dot слева, каталог + version справа ── */
        .head {
          position: absolute;
          inset: 0 0 auto 0;
          z-index: 3;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 14px 16px;
        }
        .picker {
          position: relative;
          min-width: 0;
        }
        .brand {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          max-width: 58vw;
          border: none;
          background: rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          color: #fff;
          font: inherit;
          font-weight: 600;
          font-size: 14px;
          padding: 7px 12px;
          border-radius: 999px;
          cursor: default;
        }
        .brand.switch {
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .brand.switch:hover {
          background: rgba(0, 0, 0, 0.46);
        }
        .brand:focus-visible {
          outline: 2px solid #fff;
          outline-offset: 2px;
        }
        .brand .nm {
          min-width: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .brand .chev {
          opacity: 0.7;
          font-size: 10px;
        }
        .dot {
          width: 8px;
          height: 8px;
          flex: none;
          border-radius: 50%;
          background: var(--sb-glow);
          box-shadow: 0 0 10px var(--sb-glow);
        }
        .dot.off {
          background: rgba(255, 255, 255, 0.5);
          box-shadow: none;
        }
        .menu {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          min-width: 210px;
          padding: 6px;
          background: rgba(20, 20, 26, 0.94);
          backdrop-filter: blur(22px);
          -webkit-backdrop-filter: blur(22px);
          border: 1px solid var(--sb-line);
          border-radius: 14px;
          box-shadow: 0 20px 44px -16px rgba(0, 0, 0, 0.72);
          z-index: 5;
        }
        .menu button {
          display: flex;
          align-items: center;
          gap: 9px;
          width: 100%;
          border: none;
          background: none;
          color: var(--sb-ink);
          font: inherit;
          font-size: 13px;
          text-align: left;
          padding: 9px 10px;
          border-radius: 9px;
          cursor: pointer;
        }
        .menu button:hover {
          background: var(--sb-elev-2);
        }
        .menu button[aria-current="true"] {
          color: var(--sb-glow);
        }

        /* правый кластер головы: каталог-пилюля + версия — тот же frost-рецепт */
        .head-right {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          flex: none;
        }
        .browse-btn {
          appearance: none;
          border: none;
          background: rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          color: rgba(255, 255, 255, 0.82);
          font: inherit;
          font-size: 12px;
          font-weight: 600;
          padding: 6px 12px;
          border-radius: 999px;
          cursor: pointer;
          transition:
            background 0.15s ease,
            color 0.15s ease;
        }
        .browse-btn:hover {
          background: rgba(0, 0, 0, 0.46);
          color: #fff;
        }
        .browse-btn[aria-pressed="true"] {
          color: var(--sb-glow);
        }
        .browse-btn:focus-visible {
          outline: 2px solid #fff;
          outline-offset: 2px;
        }
        .version {
          font-family: var(--sb-mono);
          font-size: 11px;
          color: rgba(255, 255, 255, 0.72);
          padding: 4px 9px;
          border-radius: 999px;
          background: rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          flex: none;
        }

        /* ── .glass (z2): фрост-стекло снизу — контейнер nowplaying + controls ── */
        .glass {
          position: relative;
          z-index: 2;
          margin-top: auto; /* прижимает стекло к низу flex-колонки .stage */
          width: 100%;
          padding: 16px 22px;
          background: linear-gradient(
            to top,
            rgba(8, 8, 12, 0.78) 0%,
            rgba(8, 8, 12, 0.5) 60%,
            rgba(8, 8, 12, 0.22) 100%
          );
          backdrop-filter: blur(18px) saturate(1.6);
          -webkit-backdrop-filter: blur(18px) saturate(1.6);
          transition:
            padding 0.45s ease,
            opacity 0.45s ease;
        }
        sboom-nowplaying {
          display: block;
        }
        sboom-controls {
          display: block;
          margin-top: 16px;
          overflow: hidden;
          max-height: 260px;
          opacity: 1;
          transition:
            max-height 0.45s ease,
            opacity 0.35s ease,
            margin-top 0.45s ease;
        }
        /* idle: контролы+громкость сворачиваются, стекло приседает — обложка
           виднее (как в панели). .stage держит высоту → без reflow дашборда. */
        .stage.idle sboom-controls {
          max-height: 0;
          opacity: 0;
          margin-top: 0;
          pointer-events: none;
        }
        .stage.idle .glass {
          padding-bottom: 12px;
          opacity: 0.92;
        }

        /* ошибка — тонкий чип поверх стекла */
        .error {
          margin: 0 0 12px;
          padding: 9px 12px;
          border-radius: var(--sb-radius-sm);
          background: color-mix(in srgb, #ff4d4f 24%, rgba(8, 8, 12, 0.6));
          border: 1px solid color-mix(in srgb, #ff4d4f 50%, transparent);
          color: #fff;
          font-size: 12px;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }

        /* ── browse: collapsible фрост-блок под immersive-картой (тот же язык стекла) ── */
        .browse-panel {
          overflow: hidden;
          max-height: 0;
          opacity: 0;
          margin-top: 0;
          transition:
            max-height 0.45s ease,
            opacity 0.35s ease,
            margin-top 0.35s ease;
        }
        .browse-panel.open {
          max-height: 62vh;
          opacity: 1;
          margin-top: 10px;
        }
        .browse-inner {
          border: 1px solid var(--sb-line);
          border-radius: var(--sb-radius);
          background:
            radial-gradient(
              120% 120% at 12% 0%,
              var(--sb-glow-soft),
              transparent 55%
            ),
            rgba(20, 20, 26, 0.72);
          backdrop-filter: blur(18px) saturate(1.4);
          -webkit-backdrop-filter: blur(18px) saturate(1.4);
          box-shadow: 0 18px 44px -26px rgba(0, 0, 0, 0.6);
          padding: 12px 14px 14px;
          max-height: 62vh;
          overflow: auto;
        }
        sboom-browse {
          display: block;
        }

        /* ── адаптив ── */
        @media (max-width: 480px) {
          .stage {
            aspect-ratio: 4 / 5;
            min-height: 300px;
          }
          .glass {
            padding: 14px 16px;
          }
          .brand {
            max-width: 52vw;
          }
          .version {
            display: none;
          }
        }

        /* ── reduced-motion: гасим glow-transition и коллапс-анимации ── */
        @media (prefers-reduced-motion: reduce) {
          .root,
          .glass,
          sboom-controls,
          .browse-panel,
          .brand.switch,
          .browse-btn {
            transition: none;
          }
        }
      `,
    ];
  }

  render() {
    const connected = this._state?.connected;
    const cover = this._state?.track?.cover_url || "";
    const multi = this._devices.length > 1;
    return html`
      <div
        class="root"
        style=${this._glow ? `--sb-glow:${this._glow}` : nothing}
      >
        <!-- immersive-карта: обложка-фон + вуаль + фрост-стекло снизу -->
        <div
          class="stage ${this._idle ? "idle" : ""}"
          @toast=${this._onToast}
          @command-done=${this._fetchState}
          @pointermove=${this._wake}
          @pointerdown=${this._wake}
          @touchstart=${this._wake}
        >
          <!-- .art (z0): обложка = фон карточки / фолбэк-градиент -->
          <div class="art ${cover ? "" : "empty"}">
            ${cover ? html`<img src=${cover} alt="" />` : nothing}
          </div>

          <!-- .veil (z1): верхняя вуаль под .head -->
          <div class="veil"></div>

          <!-- .head (z3): picker/dot слева, каталог + version справа -->
          <div class="head">
            <div class="picker">
              <button
                class="brand ${multi ? "switch" : ""}"
                aria-haspopup=${multi ? "menu" : nothing}
                aria-expanded=${multi ? String(this._picker) : nothing}
                @click=${multi ? this._togglePicker : nothing}
              >
                <span class="dot ${connected ? "" : "off"}"></span>
                <span class="nm">${this._deviceName}</span>
                ${multi ? html`<span class="chev">▾</span>` : nothing}
              </button>
              ${
                this._picker && multi
                  ? html`<div class="menu" role="menu">
                      ${this._devices.map(
                        (d) =>
                          html`<button
                            role="menuitemradio"
                            aria-current=${
                              d.entry_id === this._entryId ? "true" : "false"
                            }
                            @click=${() => this._selectDevice(d.entry_id)}
                          >
                            <span class="dot"></span>${d.name}
                          </button>`,
                      )}
                    </div>`
                  : nothing
              }
            </div>

            <div class="head-right">
              <button
                class="browse-btn"
                aria-pressed=${String(this._browseOpen)}
                @click=${this._toggleBrowse}
              >
                ${this._browseOpen ? "Свернуть" : "Каталог"}
              </button>
              <span class="version">v${CARD_VERSION}</span>
            </div>
          </div>

          <!-- .glass (z2): фрост-стекло снизу → nowplaying + controls -->
          <div class="glass">
            ${
              this._error
                ? html`<div class="error">${this._error}</div>`
                : nothing
            }
            <sboom-nowplaying
              .state=${this._state}
              @seek=${this._onSeek}
            ></sboom-nowplaying>
            <sboom-controls
              .hass=${this.hass}
              .state=${this._state}
              .entryId=${this._entryId}
            ></sboom-controls>
          </div>
        </div>

        <!-- browse: collapsible фрост-панель под immersive-картой -->
        <div class="browse-panel ${this._browseOpen ? "open" : ""}">
          <div class="browse-inner">
            ${
              this._browseOpen
                ? html`<sboom-browse
                    .hass=${this.hass}
                    .entryId=${this._entryId}
                    .currentTrackId=${this._state?.track?.track_id}
                  ></sboom-browse>`
                : nothing
            }
          </div>
        </div>

        <sboom-toast></sboom-toast>
      </div>
    `;
  }
}

customElements.define("sboom-card", SboomCard);

// каталог карточек HA (кнопка «+ Добавить карточку»)
window.customCards = window.customCards || [];
window.customCards.push({
  type: "sboom-card",
  name: "SBoom Card",
  description:
    "Плеер SberBoom: now-playing, транспорт и drill-down каталог Звука. Требует интеграцию sboom_ha.",
  preview: true,
  documentationURL: "https://github.com/dzerik/ha-sboom-card",
});

// eslint-disable-next-line no-console
console.info(
  `%c SBOOM-CARD %c v${CARD_VERSION} `,
  "background:#7c5cff;color:#fff;border-radius:3px 0 0 3px;padding:2px 6px",
  "background:#1c1f26;color:#e8eaed;border-radius:0 3px 3px 0;padding:2px 6px",
);
