"""Composable email HTML components (Quiet Library Design)."""

import html

# Design tokens
EMAIL_LOGO_URL = "https://geetanjaliapp.com/logo-email.png"
EMAIL_APP_URL = "https://geetanjaliapp.com"


def email_header(subtitle: str) -> str:
    """
    Generate email header with logo, brand name, and subtitle.

    Args:
        subtitle: Contextual subtitle (e.g., "Daily Wisdom", "Account Security")

    Returns:
        HTML string for header section
    """
    return f"""
            <!-- HEADER -->
            <div style="background: linear-gradient(to bottom, #fffbeb, #fef3c7); padding: 28px 24px; text-align: center; border-bottom: 1px solid #fde68a;">
                <!-- Logo -->
                <img src="{EMAIL_LOGO_URL}" alt="Geetanjali" width="48" height="48" style="margin-bottom: 10px;">
                <!-- Brand name -->
                <h1 style="color: #78350f; font-size: 20px; margin: 0 0 4px 0; font-family: Georgia, 'Times New Roman', serif; font-weight: 500; letter-spacing: 0.5px;">
                    Geetanjali
                </h1>
                <p style="color: #92400e; font-size: 11px; margin: 0; letter-spacing: 2px; text-transform: uppercase;">
                    {subtitle}
                </p>
            </div>
    """


def email_footer(links: list[tuple[str, str]]) -> str:
    """
    Generate dark email footer with links.

    Args:
        links: List of (label, url) tuples for footer links

    Returns:
        HTML string for footer section
    """
    if links:
        link_html = '<span style="color: #525252; margin: 0 8px;">·</span>'.join(
            f'<a href="{url}" style="color: #a8a29e; font-size: 12px; text-decoration: none;">{label}</a>'
            for label, url in links
        )
    else:
        link_html = ""

    return f"""
            <!-- FOOTER -->
            <div style="background: #292524; padding: 24px; text-align: center;">
                <p style="color: #d6d3d1; font-size: 13px; margin: 0 0 4px 0; font-family: Georgia, 'Times New Roman', serif;">
                    Geetanjali
                </p>
                <p style="color: #78716c; font-size: 12px; margin: 0 0 16px 0;">
                    Wisdom for modern life
                </p>
                {f'<p style="margin: 0;">{link_html}</p>' if link_html else ''}
            </div>
    """


def email_button(text: str, url: str) -> str:
    """
    Generate orange CTA button.

    Args:
        text: Button text
        url: Button URL

    Returns:
        HTML string for button
    """
    return f"""
                <div style="text-align: center; margin: 24px 0;">
                    <a href="{url}"
                       style="display: inline-block; background: #ea580c; color: white; padding: 12px 28px; text-decoration: none; border-radius: 10px; font-weight: 500; font-size: 14px;">
                        {text}
                    </a>
                </div>
    """


def email_section(title: str, content: str, accent: bool = False) -> str:
    """
    Generate content section with optional left border accent.

    Args:
        title: Section title (uppercase)
        content: Section content HTML
        accent: Whether to show left border accent

    Returns:
        HTML string for section
    """
    border_style = "border-left: 3px solid #f59e0b;" if accent else ""
    bg_style = (
        "background: #fefce8;" if accent else "background: rgba(254, 243, 199, 0.5);"
    )

    return f"""
                <div style="margin-bottom: 24px; padding: 16px 20px; {bg_style} border-radius: 10px; {border_style}">
                    <h2 style="color: #92400e; font-size: 11px; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600;">
                        {title}
                    </h2>
                    {content}
                </div>
    """


def email_html_wrapper(body_content: str, header: str, footer: str) -> str:
    """
    Wrap email content in full HTML document structure.

    Args:
        body_content: Main body HTML content
        header: Header HTML from email_header()
        footer: Footer HTML from email_footer()

    Returns:
        Complete HTML email document
    """
    return f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #fefce8; font-family: 'Source Sans 3', system-ui, -apple-system, sans-serif;">
        <!-- Wrapper -->
        <div style="max-width: 600px; margin: 0 auto;">
            {header}
            <!-- BODY -->
            <div style="background: #fffbeb; padding: 28px 24px;">
                {body_content}
            </div>
            {footer}
        </div>
    </body>
    </html>
    """


def email_greeting(greeting: str, name: str, show_date: bool = False) -> str:
    """
    Generate greeting with optional date.

    Args:
        greeting: Greeting text (e.g., "Hello", "Good morning")
        name: Recipient name
        show_date: Whether to show current date

    Returns:
        HTML string for greeting
    """
    from datetime import datetime

    date_html = ""
    if show_date:
        current_date = datetime.utcnow().strftime("%B %d, %Y")
        date_html = f'<p style="color: #a8a29e; font-size: 13px; margin: 0 0 24px 0;">{current_date}</p>'

    return f"""
                <p style="color: #57534e; font-size: 16px; margin: 0 0 {'4px' if show_date else '16px'} 0;">
                    {html.escape(greeting)}, {html.escape(name)}
                </p>
                {date_html}
    """


def email_paragraph(text: str, muted: bool = False) -> str:
    """
    Generate paragraph with proper styling.

    Args:
        text: Paragraph text
        muted: Whether to use muted color

    Returns:
        HTML string for paragraph
    """
    color = "#78716c" if muted else "#57534e"
    return f'<p style="color: {color}; font-size: 15px; line-height: 1.7; margin: 0 0 16px 0;">{text}</p>'


def email_fallback_link(url: str) -> str:
    """
    Generate fallback link text for accessibility.

    Args:
        url: The URL to display

    Returns:
        HTML string for fallback link
    """
    return f"""
                <p style="color: #a8a29e; font-size: 12px; margin: 16px 0 0 0;">
                    If the button doesn't work, copy and paste this link:<br>
                    <a href="{url}" style="color: #d97706; word-break: break-all;">{url}</a>
                </p>
    """
