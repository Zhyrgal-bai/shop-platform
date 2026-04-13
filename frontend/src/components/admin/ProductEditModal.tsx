import { useCallback, useEffect, useState } from "react";
import { adminService } from "../../services/admin.service";
import {
  PRODUCT_CATEGORIES,
  PRODUCT_SIZES,
} from "../../constants/productCatalog";
import type { Product, Variant } from "../../types";
import { getProductImages } from "../../utils/product";

const CATEGORY_OPTIONS = PRODUCT_CATEGORIES;
const SIZE_OPTIONS = PRODUCT_SIZES;
type SizeOption = (typeof SIZE_OPTIONS)[number];

type SizeRow = { enabled: boolean; stock: number | "" };

type VariantDraft = {
  sid: string;
  color: string;
  sizes: Record<SizeOption, SizeRow>;
};

function newSid() {
  return globalThis.crypto?.randomUUID?.() ?? `e-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function emptySizes(): Record<SizeOption, SizeRow> {
  const sizes = {} as Record<SizeOption, SizeRow>;
  for (const s of SIZE_OPTIONS) {
    sizes[s] = { enabled: false, stock: "" };
  }
  return sizes;
}

function createEmptyVariant(): VariantDraft {
  return { sid: newSid(), color: "", sizes: emptySizes() };
}

function productToDrafts(p: Product): VariantDraft[] {
  const vv = p.variants && p.variants.length > 0 ? p.variants : [];
  if (vv.length === 0) {
    return [createEmptyVariant()];
  }
  return vv.map((v) => {
    const sizes = emptySizes();
    for (const s of v.sizes ?? []) {
      const key = s.size;
      if ((SIZE_OPTIONS as readonly string[]).includes(key)) {
        sizes[key as SizeOption] = { enabled: true, stock: s.stock };
      }
    }
    return { sid: newSid(), color: v.color, sizes };
  });
}

function draftsToVariants(drafts: VariantDraft[]): Variant[] {
  return drafts.map((d) => {
    const sizes = SIZE_OPTIONS.filter((sz) => d.sizes[sz].enabled).map((sz) => {
      const st = d.sizes[sz].stock;
      const stock = typeof st === "number" && !Number.isNaN(st) ? st : 0;
      return { size: sz, stock };
    });
    return { color: d.color.trim(), sizes };
  });
}

const CAT_SET = new Set<string>(PRODUCT_CATEGORIES);

type Props = {
  open: boolean;
  productId: number | null;
  onClose: () => void;
  onSaved: () => void;
};

export default function ProductEditModal({
  open,
  productId,
  onClose,
  onSaved,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [price, setPrice] = useState<number | "">("");
  const [category, setCategory] = useState<string>(CATEGORY_OPTIONS[0]);
  const [discountPercent, setDiscountPercent] = useState<number | "">("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [mainIdx, setMainIdx] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [variantDrafts, setVariantDrafts] = useState<VariantDraft[]>([
    createEmptyVariant(),
  ]);

  const resetFromProduct = useCallback((p: Product) => {
    setName(p.name);
    setPrice(p.price);
    const cat = p.category?.trim() ?? "";
    setCategory(CAT_SET.has(cat) ? cat : CATEGORY_OPTIONS[0]);
    setDiscountPercent(
      p.discountPercent != null && Number.isFinite(p.discountPercent)
        ? Math.min(100, Math.max(0, Math.round(Number(p.discountPercent))))
        : 0
    );
    setDescription(p.description ?? "");
    const imgs = getProductImages(p);
    setImages([...imgs]);
    setMainIdx(0);
    setVariantDrafts(productToDrafts(p));
  }, []);

  useEffect(() => {
    if (!open || productId == null) {
      setLoadError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void (async () => {
      try {
        const p = await adminService.getProduct(productId);
        if (cancelled) return;
        resetFromProduct(p);
      } catch (e) {
        if (!cancelled) {
          setLoadError(
            e instanceof Error ? e.message : "Не удалось загрузить товар"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, productId, resetFromProduct]);

  const updateDraft = (sid: string, patch: Partial<Pick<VariantDraft, "color">>) => {
    setVariantDrafts((prev) =>
      prev.map((v) => (v.sid === sid ? { ...v, ...patch } : v))
    );
  };

  const setSizeEnabled = (sid: string, size: SizeOption, enabled: boolean) => {
    setVariantDrafts((prev) =>
      prev.map((v) => {
        if (v.sid !== sid) return v;
        const next = { ...v.sizes[size], enabled };
        if (!enabled) next.stock = "";
        return { ...v, sizes: { ...v.sizes, [size]: next } };
      })
    );
  };

  const setSizeStock = (sid: string, size: SizeOption, stock: number | "") => {
    setVariantDrafts((prev) =>
      prev.map((v) =>
        v.sid === sid
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
    setVariantDrafts((prev) => [...prev, createEmptyVariant()]);
  };

  const removeVariant = (sid: string) => {
    setVariantDrafts((prev) =>
      prev.length <= 1 ? prev : prev.filter((v) => v.sid !== sid)
    );
  };

  const removeImageAt = (index: number) => {
    setImages((prev) => {
      const next = prev.filter((_, i) => i !== index);
      setMainIdx((m) => {
        if (next.length === 0) return 0;
        if (index === m) return 0;
        if (index < m) return Math.max(0, m - 1);
        return Math.min(m, next.length - 1);
      });
      return next;
    });
  };

  const handleAddFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    setSaveError(null);
    try {
      const urls = await adminService.uploadImages(Array.from(files));
      setImages((prev) => [...prev, ...urls]);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Ошибка загрузки изображений"
      );
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleSave = async () => {
    if (productId == null) return;
    setSaveError(null);

    const priceNum = typeof price === "number" ? price : Number(price);
    if (!name.trim() || !priceNum || priceNum <= 0) {
      setSaveError("Укажите название и цену.");
      return;
    }
    const disc = discountPercent === "" ? 0 : Number(discountPercent);
    if (!Number.isFinite(disc) || disc < 0 || disc > 100) {
      setSaveError("Скидка: от 0 до 100.");
      return;
    }
    if (images.length === 0) {
      setSaveError("Нужно хотя бы одно фото.");
      return;
    }

    for (let i = 0; i < variantDrafts.length; i++) {
      const d = variantDrafts[i];
      if (!d) continue;
      if (!d.color.trim()) {
        setSaveError(`Вариант ${i + 1}: укажите цвет (текст).`);
        return;
      }
      const enabled = SIZE_OPTIONS.filter((sz) => d.sizes[sz].enabled);
      if (enabled.length === 0) {
        setSaveError(`Вариант ${i + 1}: выберите размеры.`);
        return;
      }
      for (const sz of enabled) {
        const st = d.sizes[sz].stock;
        const n = typeof st === "number" ? st : Number(st);
        if (!Number.isFinite(n) || n <= 0) {
          setSaveError(`Вариант ${i + 1}: остаток для ${sz}.`);
          return;
        }
      }
    }

    const ordered =
      images.length === 0
        ? []
        : (() => {
            const i = Math.min(Math.max(0, mainIdx), images.length - 1);
            const main = images[i];
            if (main === undefined) return images;
            return [main, ...images.filter((_, j) => j !== i)];
          })();

    const variants = draftsToVariants(variantDrafts);

    setSaving(true);
    try {
      await adminService.updateProduct(productId, {
        name: name.trim(),
        price: Math.round(priceNum),
        category,
        discountPercent: Math.round(disc),
        description: description.trim(),
        images: ordered,
        image: ordered[0] ?? "",
        variants,
      });
      onSaved();
      onClose();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  if (!open || productId == null) return null;

  return (
    <div
      className="admin-modal-overlay"
      role="presentation"
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <div
        className="admin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-edit-product-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="admin-modal__head">
          <h2 id="admin-edit-product-title" className="admin-modal__title">
            Редактирование товара
          </h2>
          <button
            type="button"
            className="admin-modal__close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        <div className="admin-modal__body">
          {loading && <p className="admin-dash-page__muted">Загрузка…</p>}
          {loadError && (
            <div className="admin-form-error" role="alert">
              {loadError}
            </div>
          )}
          {saveError && (
            <div className="admin-form-error" role="alert">
              {saveError}
            </div>
          )}

          {!loading && !loadError && (
            <>
              <div className="admin-form-section">
                <label className="admin-field-label" htmlFor="em-name">
                  Название
                </label>
                <input
                  id="em-name"
                  className="admin-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="admin-form-section admin-modal__row2">
                <div>
                  <label className="admin-field-label" htmlFor="em-price">
                    Цена (сом)
                  </label>
                  <input
                    id="em-price"
                    type="number"
                    className="admin-input"
                    min={1}
                    step={1}
                    value={price === "" ? "" : price}
                    onChange={(e) => {
                      const v = e.target.value;
                      setPrice(v === "" ? "" : Number(v));
                    }}
                  />
                </div>
                <div>
                  <label className="admin-field-label" htmlFor="em-disc">
                    Скидка, %
                  </label>
                  <input
                    id="em-disc"
                    type="number"
                    className="admin-input"
                    min={0}
                    max={100}
                    step={1}
                    value={discountPercent === "" ? "" : discountPercent}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDiscountPercent(v === "" ? "" : Number(v));
                    }}
                  />
                </div>
              </div>
              <div className="admin-form-section">
                <label className="admin-field-label" htmlFor="em-cat">
                  Категория
                </label>
                <select
                  id="em-cat"
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
              <div className="admin-form-section">
                <label className="admin-field-label" htmlFor="em-desc">
                  Описание
                </label>
                <textarea
                  id="em-desc"
                  className="admin-input admin-textarea"
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="admin-form-section">
                <span className="admin-field-label">Фотографии</span>
                <p className="admin-form-hint">
                  Отметьте главное фото. Можно удалить лишние и добавить новые
                  (Cloudinary).
                </p>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="admin-input"
                  disabled={uploading}
                  onChange={(e) => void handleAddFiles(e)}
                />
                {uploading && (
                  <p className="admin-form-hint">Загрузка…</p>
                )}
                <div className="admin-pm-gallery">
                  {images.map((src, idx) => (
                    <div key={`${src}-${idx}`} className="admin-pm-gallery__item">
                      <img src={src} alt="" />
                      <label className="admin-pm-gallery__main">
                        <input
                          type="radio"
                          name="main-photo"
                          checked={mainIdx === idx}
                          onChange={() => setMainIdx(idx)}
                        />
                        <span>Главное</span>
                      </label>
                      <button
                        type="button"
                        className="admin-pm-gallery__remove"
                        onClick={() => removeImageAt(idx)}
                      >
                        Удалить
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="admin-form-divider" />
              <p className="admin-form-hint">Варианты: цвет (текст) и остатки</p>

              {variantDrafts.map((draft, index) => (
                <div key={draft.sid} className="admin-variant">
                  <div className="admin-variant-head">
                    <span className="admin-variant-title">Вариант {index + 1}</span>
                    {variantDrafts.length > 1 && (
                      <button
                        type="button"
                        className="admin-variant-remove"
                        onClick={() => removeVariant(draft.sid)}
                      >
                        Удалить вариант
                      </button>
                    )}
                  </div>
                  <div className="admin-form-section">
                    <label className="admin-field-label" htmlFor={`em-c-${draft.sid}`}>
                      Цвет (текст)
                    </label>
                    <input
                      id={`em-c-${draft.sid}`}
                      className="admin-input"
                      placeholder="чёрный, белый…"
                      value={draft.color}
                      onChange={(e) =>
                        updateDraft(draft.sid, { color: e.target.value })
                      }
                    />
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
                              setSizeEnabled(draft.sid, size, e.target.checked)
                            }
                          />
                          <span className="admin-size-chip-text">{size}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="admin-stock-block">
                    <span className="admin-field-label">Остаток</span>
                    {SIZE_OPTIONS.filter((sz) => draft.sizes[sz].enabled).length ===
                    0 ? (
                      <p className="admin-stock-placeholder">Отметьте размеры</p>
                    ) : (
                      SIZE_OPTIONS.filter((sz) => draft.sizes[sz].enabled).map(
                        (size) => (
                          <div key={size} className="admin-stock-row">
                            <span className="admin-stock-size">{size}</span>
                            <input
                              type="number"
                              className="admin-input"
                              min={0}
                              value={
                                draft.sizes[size].stock === ""
                                  ? ""
                                  : draft.sizes[size].stock
                              }
                              onChange={(e) => {
                                const v = e.target.value;
                                setSizeStock(
                                  draft.sid,
                                  size,
                                  v === "" ? "" : Number(v)
                                );
                              }}
                            />
                          </div>
                        )
                      )
                    )}
                  </div>
                </div>
              ))}

              <button
                type="button"
                className="admin-secondary-btn"
                onClick={addVariant}
              >
                + Добавить вариант
              </button>
            </>
          )}
        </div>

        <div className="admin-modal__foot">
          <button
            type="button"
            className="admin-secondary-btn"
            onClick={onClose}
            disabled={saving}
          >
            Отмена
          </button>
          <button
            type="button"
            className="admin-submit-btn"
            onClick={() => void handleSave()}
            disabled={loading || !!loadError || saving}
          >
            {saving ? "Сохранение…" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}
