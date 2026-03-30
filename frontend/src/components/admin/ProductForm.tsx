import { useState } from "react";
import { useAdminStore } from "../../store/admin.store";
import type { Variant } from "../../types";

const ProductForm = () => {
  const { addProduct } = useAdminStore();

  const [name, setName] = useState("");
  const [price, setPrice] = useState(0);
  const [image, setImage] = useState("");

  const [variants, setVariants] = useState<Variant[]>([]);

  const addVariant = () => {
    setVariants([...variants, { color: "", sizes: [] }]);
  };

  const addSize = (vIndex: number) => {
    const updated = [...variants];
    updated[vIndex].sizes.push({ size: "", stock: 0 });
    setVariants(updated);
  };

  const updateVariant = (i: number, value: string) => {
    const updated = [...variants];
    updated[i].color = value;
    setVariants(updated);
  };

  const updateSize = (
    vIndex: number,
    sIndex: number,
    key: "size" | "stock",
    value: string | number
  ) => {
    const updated = [...variants];
    if (key === "size") {
      updated[vIndex].sizes[sIndex].size = value as string;
    } else {
      updated[vIndex].sizes[sIndex].stock = value as number;
    }
    setVariants(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    await addProduct({
      name,
      price,
      image,
      description: "",
      category: "clothes",
      variants,
    });

    setName("");
    setPrice(0);
    setImage("");
    setVariants([]);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2>Добавить товар</h2>

      <input
        placeholder="Название"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="border p-2 w-full"
      />

      <input
        type="number"
        placeholder="Цена"
        value={price}
        onChange={(e) => setPrice(Number(e.target.value))}
        className="border p-2 w-full"
      />

      <input
        placeholder="Ссылка на фото"
        value={image}
        onChange={(e) => setImage(e.target.value)}
        className="border p-2 w-full"
      />

      <button type="button" onClick={addVariant}>
        + Цвет
      </button>

      {variants.map((v, i) => (
        <div key={i}>
          <input
            placeholder="Цвет"
            value={v.color}
            onChange={(e) => updateVariant(i, e.target.value)}
          />

          <button type="button" onClick={() => addSize(i)}>
            + Размер
          </button>

          {v.sizes.map((s, si) => (
            <div key={si}>
              <input
                placeholder="Размер"
                value={s.size}
                onChange={(e) =>
                  updateSize(i, si, "size", e.target.value)
                }
              />

              <input
                type="number"
                placeholder="Stock"
                value={s.stock}
                onChange={(e) =>
                  updateSize(i, si, "stock", Number(e.target.value))
                }
              />
            </div>
          ))}
        </div>
      ))}

      <button>Сохранить</button>
    </form>
  );
};

export default ProductForm;