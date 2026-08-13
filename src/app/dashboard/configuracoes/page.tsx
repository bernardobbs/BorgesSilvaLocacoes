import { createClient } from "@/lib/supabase/server";
import Settings, { MembrosSection, ConfigLocadorSection, AlterarSenhaSection } from "@/modules/dashboard/Settings";
import ConfigNotificacoes from "@/components/dashboard/ConfigNotificacoes";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    // Carregar perfil no servidor
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    return (
    <div className="space-y-6">
      <Settings initialProfile={profile} />
      {profile?.role === 'admin' && <MembrosSection />}
      {profile?.role === 'admin' && <ConfigNotificacoes />}
      <ConfigLocadorSection />
      <AlterarSenhaSection />
    </div>
  );
}
