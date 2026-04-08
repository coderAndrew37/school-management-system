// app/parent/gallery/page.tsx
import { getSession } from "@/lib/actions/auth";
import { fetchAllChildData, fetchMyChildren } from "@/lib/data/parent";
import { redirect } from "next/navigation";
import { TalentGallery } from "../_components/TalentGallery";
// Named import — the component lives at app/parent/_components/TalentGallery.tsx
// Adjust path to match your actual folder structure:
//   "@/components/TalentGallery"  if it's in components/
//   "../_components/TalentGallery" if it's in app/parent/_components/

export const metadata = { title: "Gallery | Kibali Parent Portal" };
export const revalidate = 0;

interface PageProps {
  searchParams: Promise<{ child?: string }>;
}

export default async function GalleryPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session || session.profile.role !== "parent") redirect("/login");

  const _sp = await searchParams;
  const childParam = _sp?.child;
  const children = await fetchMyChildren();
  if (children.length === 0) redirect("/parent");

  const activeChild = children.find((c) => c.id === childParam) ?? children[0]!;
  const childData = await fetchAllChildData(
    activeChild.id,
    activeChild.current_grade,
    activeChild.grade_label
  );

  return (
    <div className="min-h-screen bg-[#f5f6fa]">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <span className="text-lg">🎨</span>
          <div className="flex-1">
            <p className="text-sm font-black text-slate-800">Gallery</p>
            <p className="text-[10px] text-slate-400 font-semibold">
              {activeChild.full_name} · {childData.gallery.length} items
            </p>
          </div>
          {children.length > 1 && (
            <div className="flex gap-1.5">
              {children.map((c) => (
                <a
                  key={c.id}
                  href={`/parent/gallery?child=${c.id}`}
                  className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition-all ${
                    c.id === activeChild.id
                      ? "bg-purple-600 text-white border-purple-600"
                      : "bg-white text-slate-500 border-slate-200"
                  }`}
                >
                  {c.full_name.split(" ")[0]}
                </a>
              ))}
            </div>
          )}
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <TalentGallery
          items={childData.gallery}
          studentName={activeChild.full_name}
        />
      </div>
    </div>
  );
}
