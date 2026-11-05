import ipaddress
import socket
from urllib.parse import urlparse

FORBIDDEN_HOSTS = {
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "::1",
    "instance-data",
    "metadata.google.internal",
}


def validate_safe_url(url: str) -> str:
    """
    Validates a URL against Server-Side Request Forgery (SSRF).
    Only allows public, internet-routable HTTP/HTTPS URLs.
    Rejects private networks, loopbacks, link-local addresses, and cloud metadata.
    """
    if not url:
        raise ValueError("URL cannot be empty")
    cleaned = url.strip()
    parsed = urlparse(cleaned)
    if parsed.scheme.lower() not in ("http", "https"):
        raise ValueError(f"Invalid URL scheme '{parsed.scheme}'. Only http and https are permitted.")
    hostname = parsed.hostname
    if not hostname:
        raise ValueError("URL must have a valid hostname")

    lower_host = hostname.lower()
    if lower_host in FORBIDDEN_HOSTS or lower_host.endswith(".localhost"):
        raise ValueError(f"Access to '{hostname}' is prohibited for security reasons.")

    try:
        # Check if the hostname is directly an IP literal
        ip = ipaddress.ip_address(hostname)
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved or ip.is_unspecified:
            raise ValueError(f"Direct IP '{hostname}' belongs to a private or restricted network.")
        return cleaned.rstrip("/")
    except ValueError as val_err:
        # Not a raw IP literal; proceed to DNS resolution check
        if "belongs to a private" in str(val_err):
            raise

    try:
        addr_info = socket.getaddrinfo(hostname, None)
    except socket.gaierror as exc:
        raise ValueError(f"Could not resolve hostname '{hostname}': {exc}") from exc

    for entry in addr_info:
        sockaddr = entry[4]
        ip_str = sockaddr[0]
        try:
            ip = ipaddress.ip_address(ip_str)
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved or ip.is_unspecified:
                raise ValueError(f"Hostname '{hostname}' resolves to private/restricted IP ({ip_str}).")
        except ValueError as err:
            if "resolves to private" in str(err):
                raise

    return cleaned.rstrip("/")

