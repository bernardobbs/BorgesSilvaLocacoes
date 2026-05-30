import type { Metadata } from "next";

import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import GoogleAnalytics from "@/components/GoogleAnalytics";

const plusJakartaSans = Plus_Jakarta_Sans({
    subsets: ["latin"],
    weight: ["200", "300", "400", "500", "600", "700", "800"],
    variable: "--font-sans",
});

export const metadata: Metadata = {
    metadataBase: new URL("https://borges-silva-locacoes.vercel.app"),
    title: {
        default: "Borges Silva Locações - Gestão Inteligente de Imóveis",
        template: "%s | Borges Silva Locações",
    },
    description: "Borges Silva Locações é a plataforma completa para proprietários gerenciarem aluguéis, inquilinos e comprovantes com praticidade, segurança e profissionalismo. Controle total sobre seus imóveis, pagamentos e contratos em um só lugar.",
    keywords: [
        "gestão de locações",
        "aluguel de imóveis",
        "gerenciamento de inquilinos",
        "comprovante de aluguel",
        "contrato de locação",
        "proprietário",
        "borges-silva-locacoes",
        "sistema imobiliário",
        "administração de imóveis",
        "controle de aluguéis",
        "recibo de aluguel",
        "gestão de locação",
        "software para proprietários",
        "plataforma de imóveis",
        "gerenciar imóveis online",
        "controle financeiro imóveis",
        "cadastro de inquilinos",
        "relatórios de aluguel",
        "organização de imóveis",
        "sistema de locação",
    ],
    authors: [{ name: "Borges Silva Locações" }],
    creator: "Borges Silva Locações",
    publisher: "Borges Silva Locações",
    formatDetection: {
        email: false,
        address: false,
        telephone: false,
    },
    openGraph: {
        type: "website",
        locale: "pt_BR",
        url: "https://borges-silva-locacoes.vercel.app",
        siteName: "Borges Silva Locações",
        title: "Borges Silva Locações - Gestão Inteligente de Imóveis",
        description: "Simplifique a administração dos seus aluguéis com o Borges Silva Locações.",
        images: [
            {
                url: "/og-image.png",
                width: 1200,
                height: 630,
                alt: "Borges Silva Locações - Gestão Inteligente de Imóveis",
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: "Borges Silva Locações - Gestão Inteligente de Imóveis",
        description: "Simplifique a administração dos seus aluguéis com o Borges Silva Locações.",
        creator: "@borgessilvalocacoes",
        images: ["/og-image.png"],
    },
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': -1,
        },
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="pt-BR">
            <head>
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify({
                            "@context": "https://schema.org",
                            "@type": "Organization",
                            "name": "Borges Silva Locações",
                            "url": "https://borges-silva-locacoes.vercel.app",
                            "logo": "https://borges-silva-locacoes.vercel.app/logo.png",
                            "sameAs": [
                                "https://borges-silva-locacoes.vercel.app",
                            ],
                            "description": "Plataforma completa para gestão inteligente de aluguéis e imóveis.",
                        }),
                    }}
                />
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify({
                            "@context": "https://schema.org",
                            "@type": "WebSite",
                            "name": "Borges Silva Locações",
                            "url": "https://borges-silva-locacoes.vercel.app",
                            "potentialAction": {
                                "@type": "SearchAction",
                                "target": "https://borges-silva-locacoes.vercel.app/dashboard?q={search_term_string}",
                                "query-input": "required name=search_term_string",
                            },
                        }),
                    }}
                />
            </head>
            <body className={`${plusJakartaSans.variable} font-sans antialiased`}>
                <GoogleAnalytics />
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}

