'use client';
import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import api from '@/lib/api';
import Select from 'react-select';

interface AlamatData {
  provinsi_id: number | null;
  kabupaten_id: number | null;
  kecamatan_id: number | null;
  kelurahan_id: number | null;
  detail: string;
  kode_pos: string;
}

interface Props {
  label: string;
  value: AlamatData;
  onChange: (val: AlamatData) => void;
}

export default function AlamatForm({ label, value, onChange }: Props) {
  const [provinsis, setProvinsis] = useState([]);
  const [kabupatens, setKabupatens] = useState([]);
  const [kecamatans, setKecamatans] = useState([]);
  const [kelurahans, setKelurahans] = useState([]);

  useEffect(() => {
    api.get('/alamat/provinsi').then(r => setProvinsis(r.data.map((x: any) => ({ value: x.id, label: x.label }))));
  }, []);

  useEffect(() => {
    if (value.provinsi_id) {
      api.get(`/alamat/kabupaten/${value.provinsi_id}`)
        .then(r => setKabupatens(r.data.map((x: any) => ({ value: x.id, label: x.label }))));
    } else {
      setKabupatens([]);
    }
  }, [value.provinsi_id]);

  useEffect(() => {
    if (value.kabupaten_id) {
      api.get(`/alamat/kecamatan/${value.kabupaten_id}`)
        .then(r => setKecamatans(r.data.map((x: any) => ({ value: x.id, label: x.label }))));
    } else {
      setKecamatans([]);
    }
  }, [value.kabupaten_id]);

  useEffect(() => {
    if (value.kecamatan_id) {
      api.get(`/alamat/kelurahan/${value.kecamatan_id}`)
        .then(r => setKelurahans(r.data.map((x: any) => ({ value: x.id, label: x.label, kodepos: x.kodepos }))));
    } else {
      setKelurahans([]);
    }
  }, [value.kecamatan_id]);

  const update = (field: keyof AlamatData, val: any) => {
    const updates: Partial<AlamatData> = { [field]: val };
    if (field === 'provinsi_id') {
      updates.kabupaten_id = null;
      updates.kecamatan_id = null;
      updates.kelurahan_id = null;
      updates.kode_pos = '';
    } else if (field === 'kabupaten_id') {
      updates.kecamatan_id = null;
      updates.kelurahan_id = null;
      updates.kode_pos = '';
    } else if (field === 'kecamatan_id') {
      updates.kelurahan_id = null;
      updates.kode_pos = '';
    }
    onChange({ ...value, ...updates });
  };

  const handleKelurahanChange = (opt: any) => {
    const kodepos = opt?.kodepos ? String(opt.kodepos).slice(0, 5) : '';
    onChange({ ...value, kelurahan_id: opt?.value || null, kode_pos: kodepos });
  };

  return (
    <div className="space-y-3">
      <h3 className="font-medium text-sm text-gray-700">{label}</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Provinsi</Label>
          <Select
            options={provinsis}
            value={provinsis.find((p: any) => p.value === value.provinsi_id) || null}
            onChange={(opt: any) => update('provinsi_id', opt?.value || null)}
            placeholder="Pilih provinsi..."
            isClearable
            className="text-sm"
            menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
            menuPosition="fixed"
            styles={{ menuPortal: base => ({ ...base, zIndex: 9999 }) }}
          />
        </div>
        <div>
          <Label className="text-xs">Kabupaten/Kota</Label>
          <Select
            options={kabupatens}
            value={kabupatens.find((k: any) => k.value === value.kabupaten_id) || null}
            onChange={(opt: any) => update('kabupaten_id', opt?.value || null)}
            placeholder="Pilih kabupaten..."
            isClearable
            isDisabled={!value.provinsi_id}
            className="text-sm"
            menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
            menuPosition="fixed"
            styles={{ menuPortal: base => ({ ...base, zIndex: 9999 }) }}
          />
        </div>
        <div>
          <Label className="text-xs">Kecamatan</Label>
          <Select
            options={kecamatans}
            value={kecamatans.find((k: any) => k.value === value.kecamatan_id) || null}
            onChange={(opt: any) => update('kecamatan_id', opt?.value || null)}
            placeholder="Pilih kecamatan..."
            isClearable
            isDisabled={!value.kabupaten_id}
            className="text-sm"
            menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
            menuPosition="fixed"
            styles={{ menuPortal: base => ({ ...base, zIndex: 9999 }) }}
          />
        </div>
        <div>
          <Label className="text-xs">Kelurahan</Label>
          <Select
            options={kelurahans}
            value={kelurahans.find((k: any) => k.value === value.kelurahan_id) || null}
            onChange={handleKelurahanChange}
            placeholder="Pilih kelurahan..."
            isClearable
            isDisabled={!value.kecamatan_id}
            className="text-sm"
            menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
            menuPosition="fixed"
            styles={{ menuPortal: base => ({ ...base, zIndex: 9999 }) }}
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <Label className="text-xs">Detail Alamat</Label>
          <Textarea
            placeholder="Nama jalan, nomor, RT/RW, dll"
            value={value.detail}
            onChange={e => update('detail', e.target.value)}
            rows={2}
          />
        </div>
        <div>
          <Label className="text-xs">Kode Pos</Label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={5}
            placeholder="12345"
            value={value.kode_pos}
            onChange={e => update('kode_pos', e.target.value.replace(/\D/g, '').slice(0, 5))}
            className="w-full mt-1 px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>
    </div>
  );
}
