import { NextResponse } from 'next/server';

export async function GET() {
  const data = [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: 'com.icxstudios.app',
        sha256_cert_fingerprints: [
          '14:6D:E9:7D:0F:52:CC:CF:25:40:9E:02:2F:71:04:6D:E9:7D:0F:52:CC:CF:25:40:9E:02:2F:71:04:EC:87:BC',
        ],
      },
    },
  ];

  return NextResponse.json(data, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
