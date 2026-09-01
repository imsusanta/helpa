import React from 'react';

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export function BreadcrumbJsonLd({ items }: { items: BreadcrumbItem[] }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export interface FaqItem {
  question: string;
  answer: string;
}

export function FaqJsonLd({ items }: { items: FaqItem[] }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export function OrganizationJsonLd() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Corporation',
    name: 'Helpa Studio Technologies Pvt. Ltd.',
    alternateName: ['Helpa', 'Helpa Studio', 'Helpa WhatsApp CRM'],
    url: 'https://helpa.studio',
    logo: 'https://helpa.studio/helpa-logo.png',
    description:
      'Helpa is a 24/7 WhatsApp AI Receptionist & CRM for clinics, salons, coaching institutes, and service businesses in India, powered by the official Meta WhatsApp Cloud API.',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Level 4, Tech Park Campus, Sevoke Road',
      addressLocality: 'Siliguri',
      addressRegion: 'West Bengal',
      postalCode: '734001',
      addressCountry: 'IN',
    },
    contactPoint: [
      {
        '@type': 'ContactPoint',
        telephone: '+91-98000-00000',
        contactType: 'customer support',
        email: 'hello@helpa.studio',
        areaServed: 'IN',
        availableLanguage: ['en', 'hi'],
      },
    ],
    sameAs: [
      'https://github.com/imsusanta/helpa',
      'https://twitter.com/helpastudio',
      'https://www.linkedin.com/company/helpa-studio',
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export function SoftwareApplicationJsonLd() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Helpa WhatsApp AI Receptionist & CRM',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'All, Cloud, Web Browser, WhatsApp Business Cloud API',
    url: 'https://helpa.studio',
    image: 'https://helpa.studio/helpa-logo.png',
    screenshot: 'https://helpa.studio/assets/helpa-hero.svg',
    description:
      '24/7 AI-powered WhatsApp receptionist and patient engagement CRM for clinics, salons, coaching centers, and service businesses. Automate appointments, customer support, and lead capture with official Meta Cloud API coexistence.',
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'INR',
      lowPrice: '0',
      highPrice: '4999',
      offerCount: '3',
      offers: [
        {
          '@type': 'Offer',
          name: 'Starter Plan',
          price: '0',
          priceCurrency: 'INR',
          description: 'Free starter tier with core WhatsApp automation',
        },
        {
          '@type': 'Offer',
          name: 'Professional Clinic Plan',
          price: '1999',
          priceCurrency: 'INR',
          priceSpecification: {
            '@type': 'UnitPriceSpecification',
            price: '1999',
            priceCurrency: 'INR',
            unitText: 'MONTH',
          },
        },
        {
          '@type': 'Offer',
          name: 'Enterprise / Hospital Plan',
          price: '4999',
          priceCurrency: 'INR',
          priceSpecification: {
            '@type': 'UnitPriceSpecification',
            price: '4999',
            priceCurrency: 'INR',
            unitText: 'MONTH',
          },
        },
      ],
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.9',
      ratingCount: '150',
      bestRating: '5',
      worstRating: '1',
    },
    featureList: [
      '24/7 AI Receptionist & Auto-Responder',
      'Meta WhatsApp Business Cloud API Integration',
      'Automated Doctor & Service Appointment Booking',
      'Multi-Agent Shared Inbox with Staff Takeover',
      'Automated Reminders & Follow-Up Workflows',
      'Lead Qualification & CRM Synchronization',
      'Encrypted & Isolated DPDP-Compliant Data Storage',
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export interface ServiceSchemaProps {
  name: string;
  description: string;
  serviceType: string;
  providerName?: string;
  url: string;
}

export function ServiceJsonLd({
  name,
  description,
  serviceType,
  providerName = 'Helpa Studio',
  url,
}: ServiceSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name,
    serviceType,
    description,
    url,
    provider: {
      '@type': 'Corporation',
      name: providerName,
      url: 'https://helpa.studio',
    },
    areaServed: {
      '@type': 'Country',
      name: 'India',
    },
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: `${name} Solutions`,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
