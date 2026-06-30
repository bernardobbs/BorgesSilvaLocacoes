"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function createPropertyAction(propertyData: any) {
    try {
        const supabase = await createClient();
        
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            throw new Error('Não autorizado');
        }

        // Converter arrays vazios para null em campos integer
        const propertyDataSanitized = {
            ...propertyData,
            quartos: Array.isArray(propertyData.quartos) && propertyData.quartos.length === 0 ? null : propertyData.quartos,
            banheiros: Array.isArray(propertyData.banheiros) && propertyData.banheiros.length === 0 ? null : propertyData.banheiros,
            vagas: Array.isArray(propertyData.vagas) && propertyData.vagas.length === 0 ? null : propertyData.vagas,
            comodos: Array.isArray(propertyData.comodos) && propertyData.comodos.length === 0 ? null : propertyData.comodos,
            max_pessoas: Array.isArray(propertyData.max_pessoas) && propertyData.max_pessoas.length === 0 ? null : propertyData.max_pessoas,
        };

        const { data, error } = await supabase
            .from('imoveis')
            .insert([propertyDataSanitized])
            .select()
            .single();

        if (error) {
            throw error;
        }

        revalidatePath('/dashboard/imoveis');
        return { success: true, data };
    } catch (error: any) {
        return { success: false, error: error.message || 'Erro interno no servidor' };
    }
}

export async function updatePropertyAction(id: string, propertyData: any) {
    try {
        const supabase = await createClient();
        
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) throw new Error('Não autorizado');

        // Converter arrays vazios para null em campos integer
        const propertyDataSanitized = {
            ...propertyData,
            quartos: Array.isArray(propertyData.quartos) && propertyData.quartos.length === 0 ? null : propertyData.quartos,
            banheiros: Array.isArray(propertyData.banheiros) && propertyData.banheiros.length === 0 ? null : propertyData.banheiros,
            vagas: Array.isArray(propertyData.vagas) && propertyData.vagas.length === 0 ? null : propertyData.vagas,
            comodos: Array.isArray(propertyData.comodos) && propertyData.comodos.length === 0 ? null : propertyData.comodos,
            max_pessoas: Array.isArray(propertyData.max_pessoas) && propertyData.max_pessoas.length === 0 ? null : propertyData.max_pessoas,
        };

        const { data, error } = await supabase
            .from('imoveis')
            .update(propertyDataSanitized)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        revalidatePath('/dashboard/imoveis');
        revalidatePath(`/dashboard/imoveis/${id}`);
        return { success: true, data };
    } catch (error: any) {
        return { success: false, error: error.message || 'Erro interno no servidor' };
    }
}

export async function generateSignedUploadUrlAction(path: string) {
    try {
        const supabase = await createClient();
        
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) throw new Error('Não autorizado');

        const { data, error } = await supabase.storage
            .from('imoveis-fotos')
            .createSignedUploadUrl(path);

        if (error) {
            throw error;
        }

        return { success: true, signedUrl: data.signedUrl };
    } catch (error: any) {
        return { success: false, error: error.message || 'Erro ao gerar URL de upload' };
    }
}
