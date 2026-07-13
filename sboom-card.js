/**
 * SBoom Card — компактная Lovelace-карточка плеера SberBoom.
 *
 * НЕ дублирует код: наследует data-feed из `SboomFeedBase` и переиспользует
 * Lit-компоненты панели, импортируя их по URL, который РАЗДАЁТ САМА интеграция
 * `sboom_ha` (`/sboom_panel/...`, cache_headers=False). Один общий `lit-base`
 * → консистентный Lit-runtime между панелью и карточкой. Требует установленной
 * интеграции sboom_ha (иначе нет ни WS-API, ни этих модулей).
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

import { html, css, nothing } from "/sboom_panel/lit-base.js";
import { SboomFeedBase } from "/sboom_panel/components/sboom-feed-base.js";
import { tokens } from "/sboom_panel/components/sboom-tokens.css.js";
import "./sboom-card-editor.js";

const DEFAULT_GLOW = "#7C5CFF";
const CARD_VERSION = "0.1.0";

class SboomCard extends SboomFeedBase {
  static get properties() {
    return {
      _glow: { type: String },
      _picker: { type: Boolean },
      _browseOpen: { type: Boolean },
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
    return this._browseOpen ? 9 : 3;
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
      new CustomEvent("iron-resize", { bubbles: true, composed: true })
    );
  }

  static get styles() {
    return [
      tokens,
      css`
        :host {
          display: block;
        }
        .card {
          position: relative;
          background:
            radial-gradient(
              120% 120% at 12% 0%,
              var(--sb-glow-soft),
              transparent 55%
            ),
            var(--sb-elev);
          border: 1px solid var(--sb-line);
          border-radius: var(--sb-radius);
          box-shadow: 0 10px 30px -18px var(--sb-glow-soft);
          overflow: hidden;
          color: var(--sb-ink);
          font-family: system-ui, "Segoe UI", Roboto, sans-serif;
          transition: --sb-glow 0.6s ease;
        }

        /* header: колонка + статус (+ picker) + browse-toggle */
        .head {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px 4px;
        }
        .picker {
          position: relative;
          min-width: 0;
          flex: 1;
        }
        .brand {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          max-width: 100%;
          border: none;
          background: transparent;
          color: var(--sb-ink);
          font: inherit;
          font-weight: 600;
          font-size: 14px;
          padding: 2px 2px;
          border-radius: 999px;
          cursor: default;
        }
        .brand.switch {
          cursor: pointer;
        }
        .brand .nm {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .brand .chev {
          opacity: 0.6;
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
          background: var(--sb-ink-faint);
          box-shadow: none;
        }
        .menu {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          min-width: 200px;
          padding: 6px;
          background: var(--sb-elev);
          border: 1px solid var(--sb-line);
          border-radius: 12px;
          box-shadow: 0 20px 44px -16px rgba(0, 0, 0, 0.55);
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
        .browse-btn {
          appearance: none;
          border: 1px solid var(--sb-line);
          background: transparent;
          color: var(--sb-ink-dim);
          font: inherit;
          font-size: 12px;
          font-weight: 600;
          padding: 5px 12px;
          border-radius: 999px;
          cursor: pointer;
          flex: none;
          transition: color 0.15s, background 0.15s, border-color 0.15s;
        }
        .browse-btn[aria-pressed="true"] {
          color: var(--sb-ink);
          background: var(--sb-elev-2);
          border-color: transparent;
        }

        /* body: обложка-миниатюра + метаданные/скраббер */
        .body {
          display: grid;
          grid-template-columns: 104px minmax(0, 1fr);
          gap: 14px;
          align-items: center;
          padding: 8px 14px 10px;
        }
        .art {
          width: 104px;
          height: 104px;
          border-radius: var(--sb-radius-sm);
          overflow: hidden;
          background:
            radial-gradient(120% 120% at 30% 15%, var(--sb-glow-soft), transparent 60%),
            var(--sb-elev-2);
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04);
        }
        .art img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .meta {
          min-width: 0;
        }

        sboom-controls {
          display: block;
          padding: 4px 14px 12px;
        }

        .browse-wrap {
          border-top: 1px solid var(--sb-line);
          padding: 10px 14px 12px;
          max-height: 60vh;
          overflow: auto;
        }
        sboom-browse {
          display: block;
        }

        .error {
          margin: 0 14px 10px;
          padding: 10px 12px;
          background: color-mix(in srgb, #ff4d4f 18%, var(--sb-elev));
          border: 1px solid color-mix(in srgb, #ff4d4f 45%, transparent);
          border-radius: var(--sb-radius-sm);
          font-size: 12px;
        }

        @media (max-width: 420px) {
          .body {
            grid-template-columns: 84px minmax(0, 1fr);
            gap: 12px;
          }
          .art {
            width: 84px;
            height: 84px;
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
        class="card"
        style=${this._glow ? `--sb-glow:${this._glow}` : nothing}
        @toast=${this._onToast}
        @command-done=${this._fetchState}
      >
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
              ${multi ? html`<span class="chev">▾</span>` : ""}
            </button>
            ${this._picker && multi
              ? html`<div class="menu" role="menu">
                  ${this._devices.map(
                    (d) => html`<button
                      role="menuitemradio"
                      aria-current=${d.entry_id === this._entryId
                        ? "true"
                        : "false"}
                      @click=${() => this._selectDevice(d.entry_id)}
                    >
                      <span class="dot"></span>${d.name}
                    </button>`
                  )}
                </div>`
              : ""}
          </div>
          <button
            class="browse-btn"
            aria-pressed=${String(this._browseOpen)}
            @click=${this._toggleBrowse}
          >
            ${this._browseOpen ? "Свернуть" : "Каталог"}
          </button>
        </div>

        ${this._error ? html`<div class="error">${this._error}</div>` : ""}

        <div class="body">
          <div class="art">
            ${cover ? html`<img src=${cover} alt="" />` : ""}
          </div>
          <div class="meta">
            <sboom-nowplaying
              .state=${this._state}
              @seek=${this._onSeek}
            ></sboom-nowplaying>
          </div>
        </div>

        <sboom-controls
          .hass=${this.hass}
          .state=${this._state}
          .entryId=${this._entryId}
        ></sboom-controls>

        ${this._browseOpen
          ? html`<div class="browse-wrap">
              <sboom-browse
                .hass=${this.hass}
                .entryId=${this._entryId}
                .currentTrackId=${this._state?.track?.track_id}
              ></sboom-browse>
            </div>`
          : ""}
      </div>

      <sboom-toast></sboom-toast>
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
console.info(`%c SBOOM-CARD %c v${CARD_VERSION} `, "background:#7c5cff;color:#fff;border-radius:3px 0 0 3px;padding:2px 6px", "background:#1c1f26;color:#e8eaed;border-radius:0 3px 3px 0;padding:2px 6px");
