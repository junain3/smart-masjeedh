import Link from "next/link";
import { Shield, Lock, Eye, Mail } from "lucide-react";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-md p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
          <p className="text-sm text-gray-500 mb-8">Last updated: September 2026</p>

          <div className="prose prose-emerald max-w-none">
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-600" />
                Introduction
              </h2>
              <p className="text-gray-700 leading-relaxed">
                Smart Masjeedh ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our masjid management application. Please read this policy carefully.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Eye className="w-5 h-5 text-emerald-600" />
                Information We Collect
              </h2>
              <div className="space-y-4 text-gray-700">
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Authentication Information</h3>
                  <p className="leading-relaxed">
                    We use Supabase for user authentication. When you create an account, we collect your email address and password. Your password is securely hashed and stored by Supabase's authentication system.
                  </p>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Masjid Management Data</h3>
                  <p className="leading-relaxed">
                    To provide masjid management services, we collect information including:
                  </p>
                  <ul className="list-disc pl-6 mt-2 space-y-1">
                    <li>Family records (names, contact information, family codes)</li>
                    <li>Member details (names, ages, gender, phone numbers)</li>
                    <li>Financial data (collections, subscriptions, accounts)</li>
                    <li>Event information and attendance records</li>
                    <li>Staff and management records</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Masjid Profile Information</h3>
                  <p className="leading-relaxed">
                    We collect masjid-specific information such as masjid name, logo, tagline, and preferred language to personalize your experience.
                  </p>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Lock className="w-5 h-5 text-emerald-600" />
                How We Use Your Information
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                We use the collected information for the following purposes:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>To provide and maintain our masjid management services</li>
                <li>To authenticate users and secure access to the application</li>
                <li>To manage family, member, and financial records</li>
                <li>To track collections and subscriptions</li>
                <li>To generate reports and analytics for masjid administration</li>
                <li>To communicate with users about service updates</li>
                <li>To comply with legal obligations</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-600" />
                Data Security
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                We implement appropriate technical and organizational measures to protect your data:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>All data is stored securely using Supabase, which employs industry-standard encryption</li>
                <li>Authentication is managed through Supabase Auth with secure password hashing</li>
                <li>Role-based access control ensures users can only access data relevant to their permissions</li>
                <li>Regular security updates and monitoring are performed to maintain system integrity</li>
                <li>Data transmission is encrypted using HTTPS/TLS protocols</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Data Sharing and Disclosure</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                We do not sell, trade, or rent your personal information to third parties. We may share your information only in the following circumstances:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>With authorized masjid administrators and staff who require access for their roles</li>
                <li>With service providers (e.g., Supabase) who perform services on our behalf</li>
                <li>When required by law or to protect our rights, property, or safety</li>
                <li>In connection with a merger, acquisition, or sale of assets</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Rights</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                You have the following rights regarding your personal information:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>Access to your personal data</li>
                <li>Correction of inaccurate data</li>
                <li>Deletion of your personal data (subject to retention requirements)</li>
                <li>Opt-out of non-essential data processing</li>
                <li>Data portability</li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-4">
                To exercise these rights, please contact us using the information provided below.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Mail className="w-5 h-5 text-emerald-600" />
                Contact Information
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:
              </p>
              <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4">
                <p className="text-gray-700">
                  <strong>Email:</strong> support@smartmasjeedh.com
                </p>
                <p className="text-gray-700 mt-2">
                  We will respond to your inquiries within a reasonable timeframe.
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Changes to This Policy</h2>
              <p className="text-gray-700 leading-relaxed">
                We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy on this page and updating the "Last updated" date. We encourage you to review this policy periodically.
              </p>
            </section>

            <div className="border-t border-gray-200 pt-6 mt-8">
              <Link
                href="/"
                className="inline-flex items-center text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
              >
                ← Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
