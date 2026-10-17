import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { img } from "@/lib/api";
import { useApp, useTitle } from "@/lib/store";
import { GridSkeleton } from "@/components/shop";

export default function Categories() {
  const { t, L } = useApp();
  const [cats, setCats] = useState(null);
  useTitle(t("categories"));
  useEffect(() => { api.get("/categories").then((r) => setCats(r.data)); }, []);
  return (
    <div className="container-x py-6" data-testid="categories-page">
      <h1 className="mb-5 text-3xl sm:text-4xl">{t("categories")}</h1>
      {!cats ? <GridSkeleton /> : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-5">
          {cats.map((c) => (
            <Link key={c.slug} to={`/products?category=${c.slug}`} className="card group overflow-hidden fade-up" data-testid={`category-card-${c.slug}`}>
              <div className="aspect-square overflow-hidden"><img src={img(c.image)} alt={c.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" /></div>
              <div className="p-3"><p className="font-bold text-[#7A1F1F]">{L(c, "name")}</p><p className="text-xs text-gray-500">{c.count} {t("results")}</p></div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
