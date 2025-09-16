from django import template
register = template.Library()

@register.filter(name='add_class')
def add_class(field, css):
    """
    Uso: {{ form.campo|add_class:"form-input w-full" }}
    Añade clases CSS al widget del campo.
    """
    return field.as_widget(attrs={**field.field.widget.attrs, "class": f"{field.field.widget.attrs.get('class','')} {css}".strip()})
