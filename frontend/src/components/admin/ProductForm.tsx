import { useState } from "react";
import axios from "axios";
import { useAdminStore } from "../../store/admin.store";
import { adminService } from "../../services/admin.service";
import type { Variant } from "../../types";

const CATEGORY_OPTIONS = ["Худи", "Футболки", "Штаны"] as const;

const SIZE_OPTIONS = ["S", "M", "L", "XL"] as const;
type SizeOption = (typeof SIZE_OPTIONS)[number];

type SizeRow = {
  enabled: boolean;
  stock: number | "";
};

type VariantDraft = {
  id: string;
  color: string;
  sizes: Record<SizeOption, SizeRow>;
};

function newVariantId() {
  return globalThis.crypto?.randomUUID?.() ?? `v-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createVariantDraft(): VariantDraft {
  const sizes = {} as Record<SizeOption, SizeRow>;
  for (const s of SIZE_OPTIONS) {
    sizes[s] = { enabled: false, stock: "" };
  }
  return { id: newVariantId(), color: "#333333", sizes };
}

function expandShortHex(hex: string): string | null {
  if (/^#[0-9A-Fa-f]{3}$/.test(hex)) {
    const r = hex[1];
    const g = hex[2];
    const b = hex[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return null;
}

/** Значение для `<input type="color" />` (#rrggbb). */
function colorInputValue(raw: string): string {
  return parseHexColor(raw) ?? "#000000";
}

/** Returns normalized #RRGGBB or null if invalid. */
function parseHexColor(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const withHash = t.startsWith("#") ? t : `#${t}`;
  if (/^#[0-9A-Fa-f]{6}$/.test(withHash)) {
    return withHash.toUpperCase();
  }
  const expanded = expandShortHex(withHash);
  if (expanded && /^#[0-9A-Fa-f]{6}$/.test(expanded)) return expanded;
  return null;
}

function draftsToVariants(drafts: VariantDraft[]): Variant[] {
  return drafts.map((d) => {
    const color = (parseHexColor(d.color) ?? d.color.trim()).toUpperCase();
    const sizes = SIZE_OPTIONS.filter((sz) => d.sizes[sz].enabled).map((sz) => {
      const st = d.sizes[sz].stock;
      const stock = typeof st === "number" && !Number.isNaN(st) ? st : 0;
      return { size: sz, stock };
    });
    return { color, sizes };
  });
}

const ProductForm = () => {
  const { addProduct } = useAdminStore();

  const [name, setName] = useState("");
  const [price, setPrice] = useState<number | "">("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [category, setCategory] = useState<string>(CATEGORY_OPTIONS[0]);
  const [variantDrafts, setVariantDrafts] = useState<VariantDraft[]>([
    createVariantDraft(),
  ]);
  const [formError, setFormError] = useState<string | null>(null);

  const updateDraft = (id: string, patch: Partial<Pick<VariantDraft, "color">>) => {
    setVariantDrafts((prev) =>
      prev.map((v) => (v.id === id ? { ...v, ...patch } : v))
    );
  };

  const setSizeEnabled = (variantId: string, size: SizeOption, enabled: boolean) => {
    setVariantDrafts((prev) =>
      prev.map((v) => {
        if (v.id !== variantId) return v;
        const next = { ...v.sizes[size], enabled };
        if (!enabled) next.stock = "";
        return {
          ...v,
          sizes: { ...v.sizes, [size]: next },
        };
      })
    );
  };

  const setSizeStock = (variantId: string, size: SizeOption, stock: number | "") => {
    setVariantDrafts((prev) =>
      prev.map((v) =>
        v.id === variantId
          ? {
              ...v,
              sizes: {
                ...v.sizes,
                [size]: { ...v.sizes[size], stock },
              },
            }
          : v
      )
    );
  };

  const addVariant = () => {
    setVariantDrafts((prev) => [...prev, createVariantDraft()]);
  };

  const removeVariant = (id: string) => {
    setVariantDrafts((prev) =>
      prev.length <= 1 ? prev : prev.filter((v) => v.id !== id)
    );
  };

  const handleImageFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploadingImages(true);
    setFormError(null);
    try {
      const next = [...imageUrls];
      for (const file of Array.from(files)) {
        const url = await adminService.uploadImage(file);
        next.push(url);
      }
      setImageUrls(next);
    } catch (err) {
      console.error(err);
      setFormError(
        err instanceof Error ? err.message : "Не удалось загрузить изображение"
      );
    } finally {
      setUploadingImages(false);
      e.target.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const priceNum = typeof price === "number" ? price : Number(price);
    if (!name.trim() || !priceNum || priceNum <= 0) {
      setFormError("Укажите название и цену больше нуля.");
      return;
    }

    if (imageUrls.length === 0) {
      setFormError("Загрузите хотя бы одно изображение.");
      return;
    }

    for (let i = 0; i < variantDrafts.length; i++) {
      const d = variantDrafts[i];
      if (!d) continue;
      const enabled = SIZE_OPTIONS.filter((sz) => d.sizes[sz].enabled);
      if (enabled.length === 0) {
        setFormError(`Цвет ${i + 1}: выберите хотя бы один размер.`);
        return;
      }
      for (const sz of enabled) {
        const st = d.sizes[sz].stock;
        const n = typeof st === "number" ? st : Number(st);
        if (!Number.isFinite(n) || n <= 0) {
          setFormError(`Цвет ${i + 1}: для размера ${sz} укажите количество больше нуля.`);
          return;
        }
      }
    }

    const variants = draftsToVariants(variantDrafts);

    const data = {
      name: name.trim(),
      price: priceNum,
      image: imageUrls[0] ?? "",
      images: imageUrls,
      category,
      description: "",
      variants,
    };

    try {
      await addProduct(data);
      setFormError(null);
      setName("");
      setPrice("");
      setImageUrls([]);
      setCategory(CATEGORY_OPTIONS[0]);
      setVariantDrafts([createVariantDraft()]);
      alert("Товар добавлен ✅");
    } catch (err) {
      console.error(err);
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        setFormError("Нет прав");
        return;
      }
      if (err instanceof Error && err.message.includes("Telegram")) {
        setFormError(err.message);
        return;
      }
      setFormError("Не удалось сохранить товар. Проверьте сеть и попробуйте снова.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="admin-form">
      {formError && (
        <div className="admin-form-error" role="alert">
          {formError}
        </div>
      )}

      <div className="admin-form-section">
        <label className="admin-field-label" htmlFor="pf-name">
          Название
        </label>
        <input
          id="pf-name"
          placeholder="Название товара"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="admin-input"
          autoComplete="off"
        />
      </div>

      <div className="admin-form-section">
        <label className="admin-field-label" htmlFor="pf-price">
          Цена (сом)
        </label>
        <input
          id="pf-price"
          type="number"
          inputMode="decimal"
          min={0}
          step={1}
          placeholder="Цена"
          value={price === "" ? "" : price}
          onChange={(e) => {
            const v = e.target.value;
            setPrice(v === "" ? "" : Number(v));
          }}
          className="admin-input"
        />
      </div>

      <div className="admin-form-section">
        <label className="admin-field-label" htmlFor="pf-images">
          Изображения
        </label>
        <input
          id="pf-images"
          type="file"
          accept="image/*"
          multiple
          className="admin-input"
          disabled={uploadingImages}
          onChange={(e) => void handleImageFiles(e)}
        />
        {uploadingImages && (
          <p className="admin-form-hint">Загрузка в Cloudinary…</p>
        )}
        {imageUrls.length > 0 && (
          <div className="admin-multi-preview">
            {imageUrls.map((src) => (
              <img key={src} src={src} alt="" className="image-preview" />
            ))}
          </div>
        )}
      </div>

      <div className="admin-form-section">
        <label className="admin-field-label" htmlFor="pf-category">
          Категория
        </label>
        <select
          id="pf-category"
          className="admin-select"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="admin-form-divider" />

      <p className="admin-form-hint">Цвета и остатки по размерам (можно несколько вариантов)</p>

      {variantDrafts.map((draft, index) => {
        const previewHex = parseHexColor(draft.color);
        return (
          <div key={draft.id} className="admin-variant">
            <div className="admin-variant-head">
              <span className="admin-variant-title">Вариант {index + 1}</span>
              {variantDrafts.length > 1 && (
                <button
                  type="button"
                  className="admin-variant-remove"
                  onClick={() => removeVariant(draft.id)}
                  aria-label="Удалить вариант"
                >
                  Удалить
                </button>
              )}
            </div>

            <div className="admin-form-section">
              <span className="admin-field-label">Цвет варианта</span>
              <div className="admin-color-row">
                <div
                  title={previewHex ?? draft.color}
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background: previewHex ?? colorInputValue(draft.color),
                    border: "1px solid rgba(255,255,255,0.2)",
                    flexShrink: 0,
                  }}
                />
                <input
                  type="color"
                  id={`pf-color-${draft.id}`}
                  value={colorInputValue(draft.color)}
                  onChange={(e) =>
                    updateDraft(draft.id, { color: e.target.value.toUpperCase() })
                  }
                  className="admin-color-native"
                  aria-label={`Цвет варианта ${index + 1}`}
                />
              </div>
            </div>

            <div className="admin-form-section">
              <span className="admin-field-label">Размеры</span>
              <div className="admin-sizes">
                {SIZE_OPTIONS.map((size) => (
                  <label key={size} className="admin-size-chip">
                    <input
                      type="checkbox"
                      checked={draft.sizes[size].enabled}
                      onChange={(e) =>
                        setSizeEnabled(draft.id, size, e.target.checked)
                      }
                    />
                    <span className="admin-size-chip-text">{size}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="admin-stock-block">
              <span className="admin-field-label">Остаток по размеру</span>
              {SIZE_OPTIONS.filter((sz) => draft.sizes[sz].enabled).length === 0 ? (
                <p className="admin-stock-placeholder">Отметьте размеры выше</p>
              ) : (
                SIZE_OPTIONS.filter((sz) => draft.sizes[sz].enabled).map((size) => (
                  <div key={size} className="admin-stock-row">
                    <span className="admin-stock-size">{size}</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      placeholder="Количество"
                      value={
                        draft.sizes[size].stock === ""
                          ? ""
                          : draft.sizes[size].stock
                      }
                      onChange={(e) => {
                        const v = e.target.value;
                        setSizeStock(
                          draft.id,
                          size,
                          v === "" ? "" : Number(v)
                        );
                      }}
                      className="admin-input"
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}

      <button type="button" onClick={addVariant} className="admin-secondary-btn">
        + Добавить цвет
      </button>

      <button type="submit" className="admin-submit-btn">
        Добавить товар
      </button>
    </form>
  );
};

export default ProductForm;
