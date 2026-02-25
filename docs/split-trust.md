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

## Corporate Laptop + VPN

tang-edge deployed on corporate infrastructure acts as a network-bound unlock factor for employee laptops. The VPN becomes the location boundary — no additional tang server needed at home.

```
Corporate laptop:
  │
  └─── tang-edge on corporate infra (WAF → VPN IP pool only)
       + LUKS passphrase slot ──► fallback
```

```bash
clevis luks bind -d /dev/sdX tang '{"url": "https://tang.corp.example.com"}'
```

| Scenario | Result |
|----------|--------|
| At office (corporate network) | tang responds → **auto-unlock** |
| At home with VPN | VPN IP in allowed pool → tang responds → **auto-unlock** |
| Laptop lost/stolen, no VPN | tang rejects → **locked** |
| VPN credentials compromised (no laptop) | No LUKS header → **nothing to decrypt** |

**Kill switch**: disable the tang-edge worker → all laptops lock on next reboot, no MDM required.

**WAF rule** (Cloudflare example): restrict `/rec/*` to your VPN IP pool:

```
(ip.src ne VPN_IP_1 and ip.src ne VPN_IP_2) → Block
```

**Requires wired ethernet at boot.** Network-bound disk encryption runs in initramfs before the OS starts — WiFi drivers and WPA2/3 authentication are not available at that stage. At home a docking station or ethernet cable is required for auto-unlock. Without wired connection the disk stays locked until passphrase fallback is entered manually.

**Note on home VPN**: VPN client starts after the OS is up, so it cannot be used for the initial disk unlock at boot. Auto-unlock at home requires wired ethernet directly on the home network — not VPN.

**Best for**: corporate fleets with docking stations, developer laptops on wired home networks.

## Recommendations

- **Always keep a LUKS passphrase slot** as ultimate fallback
- **Use different providers** for each tang-edge instance to avoid correlated failures
- **WAF + Fixed IP** on cloud providers adds a network-level restriction on top of the cryptographic protocol
- **Password complexity**: the LUKS passphrase should be strong — it's your last line of defense
