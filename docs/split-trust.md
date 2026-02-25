# Split Trust Examples

Production deployment patterns using `clevis sss` (Shamir's Secret Sharing) to distribute trust across multiple Tang servers. All examples include WAF IP restriction and LUKS passphrase fallback.

## 2-of-2: Minimal Setup

Simplest split trust setup. Both servers must respond — if either is unavailable, falls back to password.

```
VPS (Fixed IP: x.x.x.x)
  │
  ├─── tang-edge on Provider A (WAF → fixed IP only)
  ├─── tang-edge on Provider B (WAF → fixed IP only)
  │
  └─── clevis sss: t=2, both required ──► LUKS open
       + LUKS passphrase slot           ──► fallback
```

```bash
clevis luks bind -d /dev/sdX sss '{
  "t": 2,
  "pins": {
    "tang": [
      {"url": "https://tang.provider-a.example.dev"},
      {"url": "https://tang.provider-b.example.dev"}
    ]
  }
}'
```

| Scenario | Result |
|----------|--------|
| Server stolen (powered off) | Wrong IP → both reject → **locked** |
| One provider compromised | 1 share, need both + correct IP → **safe** |
| One provider down | 1/2 → **password fallback** |

**Best for**: setups where security matters more than convenience. One provider down = manual password entry.

## 2-of-3: Homelab / On-Prem — 2 cloud + 1 LAN

Local network has a dedicated Tang machine. Two cloud tang-edge instances add redundancy and kill-switch capability:

```
VPS (Fixed IP: x.x.x.x)
  │
  ├─── tang-edge on Provider A (WAF → fixed IP only)
  ├─── tang-edge on Provider B (WAF → fixed IP only)
  ├─── tang (original) on a separate LAN machine
  │
  └─── clevis sss: t=2, any 2 of 3 ──► LUKS open
       + LUKS passphrase slot         ──► fallback
```

```bash
clevis luks bind -d /dev/sdX sss '{
  "t": 2,
  "pins": {
    "tang": [
      {"url": "http://192.168.1.10"},
      {"url": "https://tang.provider-a.example.dev"},
      {"url": "https://tang.provider-b.example.dev"}
    ]
  }
}'
```

| Scenario | Result |
|----------|--------|
| Server stolen (powered off) | Wrong IP → cloud servers reject → **locked** |
| One cloud account compromised | 1 share, need 1 more + correct IP → **safe** |
| Internet outage | Only local Tang = 1/3 → **password fallback** |
| One provider down | Other cloud + local = 2/3 → **unlocks** |
| Local Tang down | Cloud A + Cloud B = 2/3 → **unlocks** |

**Best for**: homelab, on-prem servers with local network access.

## 2-of-3: VPS in Datacenter — 3 cloud providers

No local network available. All Tang instances are cloud tang-edge on different providers, each behind WAF with IP restriction:

```
VPS (Fixed IP: x.x.x.x)
  │
  ├─── tang-edge on Provider A (WAF → fixed IP only)
  ├─── tang-edge on Provider B (WAF → fixed IP only)
  ├─── tang-edge on Provider C (WAF → fixed IP only)
  │
  └─── clevis sss: t=2, any 2 of 3 ──► LUKS open
       + LUKS passphrase slot         ──► fallback
```

```bash
clevis luks bind -d /dev/sdX sss '{
  "t": 2,
  "pins": {
    "tang": [
      {"url": "https://tang.provider-a.example.dev"},
      {"url": "https://tang.provider-b.example.dev"},
      {"url": "https://tang.provider-c.example.dev"}
    ]
  }
}'
```

| Scenario | Result |
|----------|--------|
| Server stolen (powered off) | Wrong IP → all 3 reject → **locked** |
| One provider compromised | 1 share, need 1 more + correct IP → **safe** |
| One provider down | Other 2 = 2/3 → **unlocks** |
| Two providers down simultaneously | 1/3 → **password fallback** |

**Best for**: remote VPS/dedicated servers without local network.

> Use different cloud providers (e.g. Cloudflare + AWS + Deno Deploy) to avoid correlated outages.

## Offsite Backups

With any setup above, encrypted disk images and LUKS partition dumps can be safely stored on any untrusted remote storage (S3, Backblaze B2, rsync.net, etc.). The backup is just encrypted data — decryption requires the Tang servers responding from the correct IP. Even if the backup storage is fully compromised, the data is unreadable without the Tang key shares.

## Tang + Passphrase (both required)

Standard LUKS passphrase slots are independent from clevis — either tang OR passphrase unlocks the disk. To make both **required together**, clevis SSS supports only `tang` and `tpm2` as pin types; there is no native passphrase pin.

### Option A: Tang + TPM2 with user PIN (recommended)

Requires a machine with a TPM 2.0 chip. The TPM holds one share and requires a user PIN at boot. Tang-edge holds the other share. Both must be present to unlock.

```bash
clevis luks bind -d /dev/sdX sss '{
  "t": 2,
  "pins": {
    "tang": [{"url": "https://tang-edge.example.dev"}],
    "tpm2": [{"pcr_bank": "sha256", "pcr_ids": "0,7", "pin": true}]
  }
}'
```

At boot: systemd-cryptsetup contacts tang-edge (network) and prompts for the TPM PIN. Both are needed.

| Scenario | Result |
|----------|--------|
| Server stolen (powered off) | No network → tang rejects → **locked** |
| TPM bypassed but no PIN | 1/2 shares → **locked** |
| Correct network + correct PIN | 2/2 → **unlocks** |
| Tang-edge down | TPM alone = 1/2 → **locked** |

**Best for**: laptops, workstations, VMs with virtual TPM.

### Option B: Encrypted keyfile (no TPM required)

Without TPM hardware you can achieve the same effect manually. A LUKS keyfile is encrypted with your passphrase. At unlock you first decrypt the keyfile (passphrase), then use it together with tang-edge.

```bash
# Setup: generate a keyfile and encrypt it with a passphrase
dd if=/dev/urandom bs=64 count=1 | base64 > /root/tang.key
openssl enc -aes-256-cbc -pbkdf2 -in /root/tang.key -out /root/tang.key.enc
# Add the raw keyfile as a LUKS slot
cryptsetup luksAddKey /dev/sdX /root/tang.key
# Remove the raw keyfile — only tang.key.enc remains
shred -u /root/tang.key
```

At unlock:

```bash
# Decrypt keyfile with passphrase, pipe to cryptsetup
openssl enc -d -aes-256-cbc -pbkdf2 -in /root/tang.key.enc | \
  cryptsetup luksOpen /dev/sdX root --key-file=-
```

Store `tang.key.enc` on a separate device or alongside the LUKS header. Without both passphrase + the encrypted keyfile the disk cannot be opened. This approach works without clevis — it is a manual two-step unlock, not suitable for automated boot.

**Best for**: servers where TPM is unavailable and unattended boot is not required.

## Recommendations

- **Always keep a LUKS passphrase slot** as ultimate fallback
- **Use different providers** for each tang-edge instance to avoid correlated failures
- **WAF + Fixed IP** on cloud providers adds a network-level restriction on top of the cryptographic protocol
- **Password complexity**: the LUKS passphrase should be strong — it's your last line of defense
