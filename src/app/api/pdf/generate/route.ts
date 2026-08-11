import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import jsPDF from 'jspdf';
import { FAMILY_OWNER_ID } from '@/lib/family';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
    userId: z.string().uuid(),
    propertyId: z.string().uuid(),
    tenantId: z.string().uuid().optional(),
    comprovante_id: z.string().uuid().optional(),
    data: z.object({
        referenceMonth: z.string().max(2),
        referenceYear: z.string().max(4),
        tenantName: z.string().max(500),
        tenantCpf: z.string().max(20),
        propertyName: z.string().max(500),
        propertyAddress: z.string().max(500),
        rentValue: z.string().max(50),
        condoValue: z.string().max(50).optional(),
        iptuValue: z.string().max(50).optional(),
        otherValue: z.string().max(50).optional(),
        totalValue: z.string().max(50),
        paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        observations: z.string().max(500).optional(),
    }),
});

const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        const parsed = bodySchema.safeParse(await request.json());
        if (!parsed.success) {
            return NextResponse.json({ success: false, error: parsed.error.issues[0].message }, { status: 400 });
        }
        const { userId, propertyId, comprovante_id, data } = parsed.data;

        // 1. Validar autenticação e obter UID real da sessão
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
        }

        // Buscar hash de autenticação se comprovante_id fornecido
        let receiptHash: string | null = null;
        let receiptNumber: string | null = null;
        if (comprovante_id) {
            const { data: comp } = await supabase
                .from('comprovantes')
                .select('receipt_hash, receipt_number')
                .eq('id', comprovante_id)
                .maybeSingle();
            receiptHash = comp?.receipt_hash || null;
            receiptNumber = comp?.receipt_number || null;
        }

        // 2. Blindagem: Validar se o userId do body é o mesmo da sessão (evita Personagem/Spoofing)
        if (user.id !== userId) {
            console.error(`[Security] Tentativa de spoofing: Sessão ${user.id} tentando agir como ${userId}`);
            return NextResponse.json({ success: false, error: 'Acesso negado' }, { status: 403 });
        }

        // 3. Blindagem: Validar se o imóvel realmente pertence a este usuário no banco
        const { data: imovelCheck, error: dbError } = await supabase
            .from('imoveis')
            .select('id')
            .eq('id', propertyId)
            .eq('proprietario_id', FAMILY_OWNER_ID)
            .single();

        if (dbError || !imovelCheck) {
            console.error(`[Security] Tentativa de acesso a imóvel alheio: Usuário ${user.id}, Imóvel ${propertyId}`);
            return NextResponse.json({ success: false, error: 'Imóvel não encontrado ou sem permissão' }, { status: 403 });
        }

        // Criar PDF com jsPDF
        const doc = new jsPDF();
        const monthName = months[parseInt(data.referenceMonth) - 1];

        // Configurar fonte e cores
        doc.setFont('helvetica');

        // Header
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('COMPROVANTE DE PAGAMENTO', 105, 20, { align: 'center' });

        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(`Referente a ${monthName}/${data.referenceYear}`, 105, 28, { align: 'center' });

        // Linha separadora
        doc.setDrawColor(200, 200, 200);
        doc.line(20, 32, 190, 32);

        // Informações do Inquilino
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        let yPos = 45;

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text('Inquilino:', 20, yPos);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(data.tenantName, 50, yPos);

        yPos += 7;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text('CPF:', 20, yPos);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text(data.tenantCpf, 50, yPos);

        yPos += 7;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text('Imóvel:', 20, yPos);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text(data.propertyName, 50, yPos);

        yPos += 7;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text('Endereço:', 20, yPos);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        const addressLines = doc.splitTextToSize(data.propertyAddress, 140);
        doc.text(addressLines, 50, yPos);

        yPos += (addressLines.length * 7) + 5;

        // Linha separadora
        doc.line(20, yPos, 190, yPos);
        yPos += 10;

        // Valores
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text('Aluguel', 20, yPos);
        doc.setTextColor(0, 0, 0);
        doc.text(data.rentValue, 190, yPos, { align: 'right' });

        if (data.condoValue && data.condoValue !== "R$ 0,00") {
            yPos += 7;
            doc.setTextColor(100, 100, 100);
            doc.text('Condomínio', 20, yPos);
            doc.setTextColor(0, 0, 0);
            doc.text(data.condoValue, 190, yPos, { align: 'right' });
        }

        if (data.iptuValue && data.iptuValue !== "R$ 0,00") {
            yPos += 7;
            doc.setTextColor(100, 100, 100);
            doc.text('IPTU', 20, yPos);
            doc.setTextColor(0, 0, 0);
            doc.text(data.iptuValue, 190, yPos, { align: 'right' });
        }

        if (data.otherValue && data.otherValue !== "R$ 0,00") {
            yPos += 7;
            doc.setTextColor(100, 100, 100);
            doc.text('Outros', 20, yPos);
            doc.setTextColor(0, 0, 0);
            doc.text(data.otherValue, 190, yPos, { align: 'right' });
        }

        yPos += 10;
        doc.line(20, yPos, 190, yPos);
        yPos += 7;

        // Total
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('Total', 20, yPos);
        doc.setTextColor(37, 99, 235); // Blue-600
        doc.text(data.totalValue, 190, yPos, { align: 'right' });

        yPos += 15;

        // Data do pagamento
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        const paymentDate = new Date(data.paymentDate);
        doc.text(`Data do pagamento: ${paymentDate.toLocaleDateString('pt-BR')}`, 105, yPos, { align: 'center' });

        // Hash de autenticação
        if (receiptHash) {
            yPos += 12;
            doc.setDrawColor(220, 220, 220);
            doc.line(20, yPos - 3, 190, yPos - 3);
            yPos += 2;
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(80, 80, 80);
            doc.text('AUTENTICAÇÃO DIGITAL', 105, yPos, { align: 'center' });
            yPos += 5;
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 100, 100);
            if (receiptNumber) {
                doc.text(`Recibo: ${receiptNumber}`, 105, yPos, { align: 'center' });
                yPos += 5;
            }
            doc.setFont('courier', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(60, 60, 60);
            doc.text(receiptHash, 105, yPos, { align: 'center' });
            yPos += 4;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(150, 150, 150);
            doc.text('Este código identifica exclusivamente este recibo e não pode ser adulterado.', 105, yPos, { align: 'center' });
            yPos += 2;
        }

        // Observações
        if (data.observations) {
            yPos += 10;
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 0, 0);
            doc.text('Observações:', 20, yPos);
            yPos += 5;
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(55, 65, 81);
            const obsLines = doc.splitTextToSize(data.observations, 170);
            doc.text(obsLines, 20, yPos);
        }

        // Footer
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(156, 163, 175);
        doc.setDrawColor(200, 200, 200);
        doc.line(20, 270, 190, 270);
        const now = new Date();
        doc.text(
            `Comprovante gerado automaticamente via Borges Silva Locações em ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR')}`,
            105,
            275,
            { align: 'center' }
        );

        // Converter para buffer
        const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

        // Upload para Supabase Storage
        const fileName = `${userId}/${propertyId}/comprovantes/${Date.now()}-${data.tenantName.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9-_]/g,'-').replace(/-+/g,'-').toLowerCase()}.pdf`;

        const { error: uploadError } = await supabase.storage
            .from('documentos')
            .upload(fileName, pdfBuffer, {
                contentType: 'application/pdf',
                upsert: false
            });

        if (uploadError) {
            console.error('Upload error:', uploadError);
            throw uploadError;
        }

        // Obter URL pública
        const { data: signed } = await supabase.storage.from("documentos").createSignedUrl(fileName, 60*60*24*7);
        const publicUrl = signed?.signedUrl || "";

        // Retornar URL e buffer
        return NextResponse.json({
            success: true,
            pdfUrl: publicUrl,
            pdfBuffer: Array.from(pdfBuffer),
        });

    } catch (error: any) {
        console.error('Error generating PDF:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao gerar documento' },
            { status: 500 }
        );
    }
}
