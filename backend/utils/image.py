"""Image processing utilities."""
import base64
from io import BytesIO
from PIL import Image
from fastapi import HTTPException
from deps import logger


def process_image_to_webp(image_data: bytes, max_size_kb: int = 100, target_size: tuple = (400, 400)) -> str:
    """Process image: resize, convert to WebP, compress to under max_size_kb. Returns base64 encoded WebP."""
    try:
        img = Image.open(BytesIO(image_data))
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')
        img.thumbnail(target_size, Image.Resampling.LANCZOS)
        new_img = Image.new('RGB', target_size, (255, 255, 255))
        offset = ((target_size[0] - img.size[0]) // 2, (target_size[1] - img.size[1]) // 2)
        new_img.paste(img, offset)
        
        quality = 90
        while quality > 20:
            buffer = BytesIO()
            new_img.save(buffer, format='WEBP', quality=quality, optimize=True)
            size_kb = buffer.tell() / 1024
            if size_kb <= max_size_kb:
                buffer.seek(0)
                return base64.b64encode(buffer.read()).decode('utf-8')
            quality -= 5
        
        buffer = BytesIO()
        new_img.save(buffer, format='WEBP', quality=20, optimize=True)
        buffer.seek(0)
        return base64.b64encode(buffer.read()).decode('utf-8')
    except Exception as e:
        logger.error(f"Image processing error: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Image processing failed: {str(e)}")


def process_slide_image(image_data: bytes) -> str:
    """Process slide image for visual aids - larger size, higher quality."""
    try:
        img = Image.open(BytesIO(image_data))
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')
        img.thumbnail((1200, 900), Image.Resampling.LANCZOS)
        quality = 85
        while quality > 30:
            buffer = BytesIO()
            img.save(buffer, format='WEBP', quality=quality, optimize=True)
            if buffer.tell() / 1024 <= 500:
                buffer.seek(0)
                return base64.b64encode(buffer.read()).decode('utf-8')
            quality -= 10
        buffer = BytesIO()
        img.save(buffer, format='WEBP', quality=30, optimize=True)
        buffer.seek(0)
        return base64.b64encode(buffer.read()).decode('utf-8')
    except Exception as e:
        logger.error(f"Slide image processing error: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Image processing failed: {str(e)}")
