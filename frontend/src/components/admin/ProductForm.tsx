import { useState } from "react";
import { useAdminStore } from "../../store/admin.store";

const ProductForm = () => {
  const { addProduct } = useAdminStore();

  const [name, setName] = useState("");
  const [price, setPrice] = useState(0);
  const [image, setImage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    await addProduct({
      name,
      price,
      image,
      category: "clothes",
      description: "",
      variants: [],
    });

    setName("");
    setPrice(0);
    setImage("");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <h2 className="font-semibold">Добавить товар</h2>

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

      <button className="bg-black text-white p-2 w-full">
        Добавить
      </button>
    </form>
  );
};

export default ProductForm;